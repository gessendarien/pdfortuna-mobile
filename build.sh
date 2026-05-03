#!/bin/bash

# Exit on error
set -e

VERSION=$(node -p "require('./package.json').version")

echo "====================================="
echo "   PDFortuna Production Builder"
echo "====================================="
echo ""
echo "Version to build: v$VERSION"
echo ""
echo "1. Create AAB"
echo "2. Create APK"
echo "3. Exit"
echo ""
read -p "Choose an option [1-3]: " option

case $option in
    1)
        echo "Building AAB..."
        cd android
        ./gradlew clean
        ./gradlew bundleRelease

        echo "Moving AAB to 'output' folder..."
        mkdir -p ../output
        cp app/build/outputs/bundle/release/app-release.aab ../output/PDFortuna-$VERSION.aab
        echo "DONE! Your AAB is ready at: output/PDFortuna-$VERSION.aab"
        ;;
    2)
        echo "Building APK..."
        cd android
        ./gradlew clean
        ./gradlew assembleRelease

        echo "Moving APK to 'output' folder..."
        mkdir -p ../output
        cp app/build/outputs/apk/release/app-release.apk ../output/PDFortuna-$VERSION.apk
        echo "Done: output/PDFortuna-$VERSION.apk"

        echo "Copying to APK/PDFortuna-latest.apk (linked to website download)..."
        mkdir -p ../APK
        cp ../output/PDFortuna-$VERSION.apk ../APK/PDFortuna-latest.apk
        echo "DONE! Website download updated: APK/PDFortuna-latest.apk"
        ;;
    3)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo "Invalid option. Exiting."
        exit 1
        ;;
esac
