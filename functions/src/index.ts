import * as functions from 'firebase-functions';
import axios from 'axios';

// sample request https://your-proj-id.cloudfunctions.net/elevation?locations=35.362,138.731|35.232,138.62
export const elevation = functions.https.onRequest(async (request: any, response: any) => {

  // 1,2|3,4 → [{lat:1, lng:2}, {lat:3,lng:4}]
  const text = request.query.locations as string ?? '';
  const latlngs = text.split('|').map(ll => {
    const arr = ll.split(',');
    return { lat: Number(arr[0]), lng: Number(arr[1]) } as LatLng;
  });

  const elevations = await new ElevationService().getElevations(latlngs);

  response.send(JSON.stringify({
    elevations: elevations
  }));
});


type LatLng = { lat: number, lng: number };
type Point = { x: number, y: number };

class ElevationService {

  private readonly tileCache = new Map<string, string[][]>();
  private readonly zoom: number = 10;

  async getTileCsv(zoomXY: string): Promise<string[][]> {
    const cache = this.tileCache.get(zoomXY);
    if (cache !== undefined) {
      return cache;
    }

    const res = await axios.get(`https://cyberjapandata.gsi.go.jp/xyz/dem/${zoomXY}.txt`);
    const tileCsv = res.data as string;
    const arr = tileCsv.split('\n').map(row => row.split(','));

    this.tileCache.set(zoomXY, arr);
    return arr;
  }

  async getElevations(aLatLngs: LatLng[]): Promise<(number | undefined)[]> {
    const elevations = [];
    for (const aLatLng of aLatLngs) {
      const p = this.latLngToPoint(aLatLng, this.zoom);
      const tileX = Math.floor(p.x / 256);
      const tileY = Math.floor(p.y / 256);
      const zoomXY = `${this.zoom}/${tileX}/${tileY}`;

      const arr = await this.getTileCsv(zoomXY);

      const xInTile = Math.floor(p.x % 256);
      const yInTile = Math.floor(p.y % 256);

      const elev = Number(arr[yInTile][xInTile]);
      elevations.push(Number.isNaN(elev) ? undefined : elev);
    }

    return elevations;
  }

  private latLngToPoint(aLatLng: LatLng, zoom: number): Point {
    const lat = aLatLng.lat / 360 * Math.PI * 2;
    const lng = aLatLng.lng / 360 * Math.PI * 2;
    const yrad = Math.log( Math.tan( Math.PI / 4 + lat / 2 ) );
    const xrad = lng + Math.PI;
    const x = Math.round( xrad / ( Math.PI * 2 ) * 256 * Math.pow( 2, zoom ) );
    const y = Math.round( ( Math.PI - yrad ) / ( Math.PI * 2 ) * 256 * Math.pow( 2, zoom ) );
    return { x: x, y: y };
  }
}
