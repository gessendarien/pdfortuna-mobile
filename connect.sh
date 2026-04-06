#!/bin/bash

# ==============================================================================
# SCRIPT UNIFICADO: Conexion y Despliegue de PDFortuna
# ==============================================================================

# 1. Configurar variables de entorno basicas
export ANDROID_HOME=$HOME/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 # Ruta por defecto en Ubuntu
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$JAVA_HOME/bin

# 2. Verificar o Instalar el SDK de Android si falta
if [ ! -d "$ANDROID_HOME" ]; then
    echo "===================================================="
    echo " Configuracion inicial: El Android SDK no se encuentra."
    echo " Instalando componentes minimos necesarios..."
    echo "===================================================="
    
    # Descargar Command Line Tools si no estan
    if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
        CMDLINE_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
        ZIP_FILE="/tmp/cmdline-tools.zip"
        
        sudo apt update && sudo apt install wget unzip -y
        mkdir -p "$ANDROID_HOME/cmdline-tools"
        
        echo "Descargando herramientas de Google..."
        wget -qO "$ZIP_FILE" "$CMDLINE_URL"
        unzip -q "$ZIP_FILE" -d "$ANDROID_HOME/cmdline-tools"
        mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest"
        rm "$ZIP_FILE"
    fi

    # Aceptar licencias e instalar plataformas
    echo "Aceptando licencias y descargando Platform 36..."
    yes | sdkmanager --licenses > /dev/null
    sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0"
    echo "Configuracion de SDK completada."
fi

# 3. Comprobar node_modules
if [ ! -d "node_modules" ]; then
    echo "No se encontro la carpeta node_modules. Instalando dependencias..."
    npm install
fi

# 4. Configurar adb reverse para el puente de depuracion
echo "Configurando adb reverse tcp:8081..."
if command -v adb >/dev/null 2>&1; then
    adb reverse tcp:8081 tcp:8081
    echo "Dispositivos detectados:"
    adb devices
else
    echo "ERROR: No se encuentra 'adb'. Por favor verifica la instalacion."
    exit 1
fi

# 5. Lanzar la aplicacion al dispositivo
echo "Iniciando Metro Bundler y enviando la app..."

# Iniciar Metro en segundo plano
npm start &
METRO_PID=$!

# Compilar e instalar en paralelo
npx react-native run-android --no-packager

# Mantener la terminal abierta para ver los logs de Metro
wait $METRO_PID
