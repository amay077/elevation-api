#!/bin/sh

echo "Deploy start"

cd functions
npm ci
cd ..

echo "token is $FIREBASE_TOKEN"

firebase deploy --only functions --token $FIREBASE_TOKEN

echo "Deploy finished"
