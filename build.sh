#!/bin/bash

# Exit on error
set -e

echo "====================================="
echo "   PDFortuna Production Builder"
echo "====================================="
echo ""
echo "1. Create AAB (For Google Play Store)"
echo "2. Create APK (For local testing)"
echo "3. Exit"
echo ""
read -p "Choose an option [1-3]: " option

case $option in
    1)
        echo "Building AAB..."
        cd android
        ./gradlew clean
        ./gradlew bundleRelease
        
        echo "Moving AAB to root 'outputs' folder..."
        mkdir -p ../outputs
        cp app/build/outputs/bundle/release/app-release.aab ../outputs/PDFortuna-release.aab
        echo "✅ DONE! Your AAB is ready at: outputs/PDFortuna-release.aab"
        ;;
    2)
        echo "Building APK..."
        cd android
        ./gradlew clean
        ./gradlew assembleRelease
        
        echo "Moving APK to root 'outputs' folder..."
        mkdir -p ../outputs
        cp app/build/outputs/apk/release/app-release.apk ../outputs/PDFortuna-release.apk
        echo "✅ DONE! Your APK is ready at: outputs/PDFortuna-release.apk"
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
