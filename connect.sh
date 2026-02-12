#!/bin/bash

# Colores
VERDE='\033[0;32m'
AZUL='\033[0;34m'
ROJO='\033[0;31m'
NC='\033[0m' # No Color

correr_app() {
    echo -e "\n${VERDE}✔ Dispositivo conectado.${NC}"
    echo -e "${AZUL} Iniciando aplicación... Espere un momento.${NC}"
    
    # Iniciar Metro Bundler en una nueva terminal si es posible, o en segundo plano
    if command -v gnome-terminal &> /dev/null; then
        gnome-terminal -- bash -c "echo 'Iniciando Metro Bundler...'; npm start; exec bash"
    elif command -v x-terminal-emulator &> /dev/null; then
        x-terminal-emulator -e "bash -c 'echo \"Iniciando Metro Bundler...\"; npm start; exec bash'"
    else
        echo -e "${ROJO}No se encontró terminal compatible para Metro. Ejecutando en segundo plano...${NC}"
        npm start > /dev/null 2>&1 &
    fi

    # Correr la aplicación en Android
    npm run android

    echo -e "\n${VERDE}¡La aplicación debería estar corriendo en tu dispositivo!${NC}"
    echo -e "${AZUL}Puedes cerrar esta ventana si todo salió bien.${NC}"
    exit 0
}

echo -e "${AZUL}=== PDFortuna Connect USB ===${NC}"

while true; do
    echo -e "\n${VERDE}Verificando conexión USB...${NC}"
    
    # Verificar si hay un dispositivo "device" (autorizado y listo)
    DISPOSITIVO=$(adb devices | grep -w "device" | grep -v "List of devices attached" | grep -v ":" | head -n 1)
    
    if [ -n "$DISPOSITIVO" ]; then
        correr_app
    fi

    # Si no, verificar si hay al menos algo conectado por USB (quizás no autorizado)
    HAY_USB=$(adb devices -l | grep "usb")
    
    if [ -n "$HAY_USB" ]; then
        echo -e "${VERDE}Dispositivo detectado.${NC}"
        correr_app
    else
        echo -e "${ROJO}No se detectó dispositivo USB.${NC}"
        echo "Asegúrate de conectar el cable y activar la depuración USB."
        read -p "Presiona Enter para reintentar o Ctrl+C para salir..."
    fi
done
