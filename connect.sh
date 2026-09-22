#!/bin/bash

# ==============================================================================
# PDFortuna - Conexión ADB y Despliegue
# ==============================================================================

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # Sin color

# Variables de entorno
export ANDROID_HOME=$HOME/Android/Sdk
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$PATH:$ANDROID_HOME/platform-tools

PACKAGE="com.pdfortuna"
APK_PATH="APK/PDFortuna-latest.apk"

echo ""
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo -e "${CYAN}   PDFortuna - Conexión ADB${NC}"
echo -e "${CYAN}═══════════════════════════════════════${NC}"
echo ""

# ── 1. Iniciar ADB y detectar dispositivo ──
echo -e "${YELLOW}▸ Iniciando ADB server...${NC}"
adb start-server 2>/dev/null

DEVICE=$(adb devices | grep -w "device" | head -n1 | awk '{print $1}')

if [ -z "$DEVICE" ]; then
    echo -e "${RED}✖ No se detectó ningún dispositivo conectado.${NC}"
    echo "  Conecta tu teléfono por USB y activa depuración USB."
    exit 1
fi

echo -e "${GREEN}✔ Dispositivo detectado: ${DEVICE}${NC}"
echo ""

# ── 2. Menú de opciones ──
echo -e "${CYAN}¿Qué deseas hacer?${NC}"
echo ""
echo "  1) Instalar APK (latest) por ADB"
echo "  2) Abrir en teléfono sin instalar (modo desarrollo)"
echo "  3) Salir"
echo ""
read -p "Opción [1-3]: " opcion

case $opcion in
    1)
        # ── Instalar APK compilado ──
        echo ""
        if [ ! -f "$APK_PATH" ]; then
            echo -e "${RED}✖ No se encontró ${APK_PATH}${NC}"
            echo "  Primero compila con: ./build.sh (opción 2)"
            exit 1
        fi

        APK_SIZE=$(du -h "$APK_PATH" | awk '{print $1}')
        echo -e "${YELLOW}▸ Instalando ${APK_PATH} (${APK_SIZE})...${NC}"

        if adb install -r "$APK_PATH" 2>&1; then
            echo ""
            echo -e "${GREEN}✔ APK instalado correctamente.${NC}"

            echo -e "${YELLOW}▸ Abriendo PDFortuna...${NC}"
            adb shell monkey -p "$PACKAGE" -c android.intent.category.LAUNCHER 1 2>/dev/null
            echo -e "${GREEN}✔ App lanzada.${NC}"
        else
            echo ""
            echo -e "${RED}✖ Error al instalar el APK.${NC}"
            exit 1
        fi
        ;;

    2)
        # ── Modo desarrollo: Metro + run-android ──
        echo ""

        # Verificar node_modules
        if [ ! -d "node_modules" ]; then
            echo -e "${YELLOW}▸ Instalando dependencias (npm install)...${NC}"
            npm install
        fi

        # Configurar puente ADB
        echo -e "${YELLOW}▸ Configurando adb reverse tcp:8081...${NC}"
        adb reverse tcp:8081 tcp:8081

        # Iniciar Metro en segundo plano
        echo -e "${YELLOW}▸ Iniciando Metro Bundler...${NC}"
        npx react-native start --port 8081 &
        METRO_PID=$!

        # Esperar a que Metro esté listo
        echo -e "${YELLOW}▸ Esperando a que Metro esté listo...${NC}"
        for i in $(seq 1 15); do
            if curl -s http://localhost:8081/status 2>/dev/null | grep -q "packager-status:running"; then
                echo -e "${GREEN}✔ Metro listo.${NC}"
                break
            fi
            sleep 1
        done

        echo -e "${YELLOW}▸ Compilando e instalando app de desarrollo...${NC}"
        echo -e "${CYAN}  (Ctrl+C para detener todo)${NC}"
        echo ""

        # Capturar Ctrl+C para matar Metro al salir
        trap "kill $METRO_PID 2>/dev/null; exit 0" INT TERM

        npx react-native run-android --no-packager

        # Mantener Metro corriendo para hot reload
        echo ""
        echo -e "${GREEN}✔ App instalada. Metro sigue corriendo para hot reload.${NC}"
        echo -e "${CYAN}  Presiona Ctrl+C para detener Metro.${NC}"
        wait $METRO_PID
        ;;

    3)
        echo "Saliendo."
        exit 0
        ;;

    *)
        echo -e "${RED}Opción inválida.${NC}"
        exit 1
        ;;
esac
