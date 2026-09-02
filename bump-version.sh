#!/bin/bash

# Este script actualiza la versión del proyecto de forma global.

if [ "$#" -ne 1 ]; then
    echo "Uso: $0 <nueva_versión>"
    echo "Ejemplo: $0 0.0.3"
    exit 1
fi

NEW_VERSION=$1

# Nos movemos al directorio donde está el script para poder ejecutarlo desde cualquier lado
cd "$(dirname "$0")" || exit

# Extraemos la versión antigua del package.json usando un patrón seguro
OLD_VERSION=$(grep -oP '(?<="version": ")[^"]*' package.json)

if [ -z "$OLD_VERSION" ]; then
    echo "Error: No se pudo obtener la versión actual de package.json"
    exit 1
fi

if [ "$OLD_VERSION" == "$NEW_VERSION" ]; then
    echo "La versión ya es $NEW_VERSION. No hay nada que hacer."
    exit 0
fi

echo "Actualizando proyecto de versión $OLD_VERSION a $NEW_VERSION..."

echo "- package.json"
sed -i "s/\"version\": \"$OLD_VERSION\"/\"version\": \"$NEW_VERSION\"/g" package.json

echo "- README.md"
sed -i "s/version-$OLD_VERSION/version-$NEW_VERSION/g" README.md

echo "- index.html"
sed -i "s/APP_VERSION = '$OLD_VERSION'/APP_VERSION = '$NEW_VERSION'/g" index.html

echo "- src/components/CreditsModal.tsx"
sed -i "s/v$OLD_VERSION/v$NEW_VERSION/g" src/components/CreditsModal.tsx

echo "- ios/PDFortuna.xcodeproj/project.pbxproj"
if [ -f "ios/PDFortuna.xcodeproj/project.pbxproj" ]; then
    # Actualiza MARKETING_VERSION conservando el resto de la estructura
    sed -i "s/MARKETING_VERSION = [^;]*;/MARKETING_VERSION = $NEW_VERSION;/g" ios/PDFortuna.xcodeproj/project.pbxproj
fi

echo ""
echo "¡Versión actualizada exitosamente a $NEW_VERSION en todos los manifiestos y vistas!"
