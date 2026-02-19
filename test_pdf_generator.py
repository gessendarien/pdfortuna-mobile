#!/usr/bin/env python3
"""
Generate a complex test PDF to evaluate react-native-pdf renderer capabilities.
Tests: forms, images with transparency, annotations, overlapping layers, gradients, signatures.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import Color, HexColor, transparent, red, blue, green, black, white, yellow, orange
from reportlab.lib.units import inch, cm
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfform
from reportlab.graphics.shapes import Drawing, Rect, Circle, String, Line, Polygon
from reportlab.graphics import renderPDF
import os
import math

OUTPUT = os.path.expanduser("~/Descargas/Test_Renderer_PDFortuna.pdf")

def create_test_pdf():
    c = canvas.Canvas(OUTPUT, pagesize=letter)
    width, height = letter

    # ============================================================
    # PAGE 1: Images with Transparency + Overlapping Layers
    # ============================================================
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 60, "Página 1: Transparencias y Capas")

    c.setFont("Helvetica", 11)
    c.drawString(50, height - 85, "Si ves cuadros negros en lugar de colores semitransparentes, el renderer falla.")

    # Draw overlapping semi-transparent rectangles
    y_start = height - 150

    # Red semi-transparent
    c.setFillColor(Color(1, 0, 0, alpha=0.4))
    c.rect(80, y_start, 200, 150, fill=1, stroke=0)

    # Blue semi-transparent overlapping
    c.setFillColor(Color(0, 0, 1, alpha=0.4))
    c.rect(180, y_start - 30, 200, 150, fill=1, stroke=0)

    # Green semi-transparent overlapping both
    c.setFillColor(Color(0, 0.7, 0, alpha=0.4))
    c.rect(130, y_start - 60, 200, 150, fill=1, stroke=0)

    # Labels
    c.setFillColor(black)
    c.setFont("Helvetica", 9)
    c.drawString(80, y_start + 155, "Rojo 40% opacidad")
    c.drawString(180, y_start + 125, "Azul 40% opacidad")
    c.drawString(130, y_start - 70, "Verde 40% opacidad")

    # Gradient-like effect with many thin transparent strips
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y_start - 120, "Gradiente simulado con transparencias:")

    for i in range(50):
        alpha = i / 50.0
        c.setFillColor(Color(0.2, 0.4, 0.9, alpha=alpha))
        c.rect(50 + i * 8, y_start - 200, 8, 50, fill=1, stroke=0)

    # Draw circles with transparency
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y_start - 270, "Círculos con transparencia:")

    colors = [
        (1, 0, 0, 0.5), (0, 1, 0, 0.5), (0, 0, 1, 0.5),
        (1, 1, 0, 0.5), (1, 0, 1, 0.5), (0, 1, 1, 0.5)
    ]
    for i, (r, g, b_val, a) in enumerate(colors):
        cx = 100 + (i % 3) * 120
        cy = y_start - 350 + (i // 3) * -80
        c.setFillColor(Color(r, g, b_val, alpha=a))
        c.circle(cx, cy, 40, fill=1, stroke=1)

    c.showPage()

    # ============================================================
    # PAGE 2: Form Fields (Interactive)
    # ============================================================
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 60, "Página 2: Formularios Interactivos")

    c.setFont("Helvetica", 11)
    c.drawString(50, height - 85, "Si no ves campos de texto, checkboxes o botones, el renderer no soporta formularios.")

    y = height - 130

    # Text fields
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Campos de texto:")
    y -= 30

    c.setFont("Helvetica", 11)
    c.drawString(50, y + 5, "Nombre:")
    c.acroForm.textfield(
        name='nombre', x=130, y=y - 2, width=250, height=22,
        value='Juan Pérez', fontSize=11,
        borderColor=HexColor('#333333'),
        fillColor=HexColor('#f0f0f0')
    )
    y -= 40

    c.drawString(50, y + 5, "Email:")
    c.acroForm.textfield(
        name='email', x=130, y=y - 2, width=250, height=22,
        value='juan@example.com', fontSize=11,
        borderColor=HexColor('#333333'),
        fillColor=HexColor('#f0f0f0')
    )
    y -= 40

    c.drawString(50, y + 5, "Comentarios:")
    c.acroForm.textfield(
        name='comments', x=130, y=y - 30, width=350, height=60,
        value='Este es un campo de texto multilínea para probar el renderizado.',
        fontSize=10,
        borderColor=HexColor('#333333'),
        fillColor=HexColor('#fffff0'),
        fieldFlags='multiline'
    )
    y -= 100

    # Checkboxes
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Checkboxes:")
    y -= 25

    c.setFont("Helvetica", 11)
    options = ["Opción A - Activada", "Opción B - Desactivada", "Opción C - Activada"]
    checked = [True, False, True]
    for i, (opt, chk) in enumerate(zip(options, checked)):
        c.acroForm.checkbox(
            name=f'check_{i}', x=50, y=y - 2,
            size=16, checked=chk,
            borderColor=HexColor('#333333'),
            fillColor=HexColor('#ffffff')
        )
        c.drawString(75, y + 2, opt)
        y -= 28

    # Radio buttons
    y -= 20
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Botones de radio:")
    y -= 25

    c.setFont("Helvetica", 11)
    radio_options = ["Selección 1", "Selección 2", "Selección 3"]
    for i, opt in enumerate(radio_options):
        c.acroForm.radio(
            name='radio_group', value=f'sel_{i}',
            x=50, y=y - 2, size=16,
            selected=(i == 0),
            borderColor=HexColor('#333333'),
            fillColor=HexColor('#ffffff')
        )
        c.drawString(75, y + 2, opt)
        y -= 28

    # Choice / Dropdown
    y -= 20
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Lista desplegable:")
    y -= 25

    c.acroForm.choice(
        name='dropdown', x=50, y=y - 2, width=200, height=22,
        value='Opción 2',
        options=['Opción 1', 'Opción 2', 'Opción 3', 'Opción 4'],
        fontSize=11,
        borderColor=HexColor('#333333'),
        fillColor=HexColor('#f0f0f0')
    )

    c.showPage()

    # ============================================================
    # PAGE 3: Annotations and Signatures Area
    # ============================================================
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 60, "Página 3: Anotaciones y Firmas")

    c.setFont("Helvetica", 11)
    c.drawString(50, height - 85, "Prueba de anotaciones de texto, links, y área de firma.")

    y = height - 130

    # Text annotations (sticky notes)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Notas adhesivas (sticky notes):")
    y -= 10

    # Create text annotations
    c.linkURL("https://www.example.com", (50, y - 30, 300, y), relative=0)
    c.setFont("Helvetica", 11)
    c.setFillColor(blue)
    c.drawString(50, y - 25, "← Enlace clickeable a example.com")
    c.setFillColor(black)
    y -= 60

    # Highlight annotation area
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Texto con resaltado simulado:")
    y -= 25

    # Yellow highlight behind text
    c.setFillColor(Color(1, 1, 0, alpha=0.4))
    c.rect(50, y - 5, 400, 20, fill=1, stroke=0)
    c.setFillColor(black)
    c.setFont("Helvetica", 12)
    c.drawString(55, y, "Este texto tiene un resaltado amarillo semitransparente detrás.")
    y -= 40

    # Another highlight
    c.setFillColor(Color(0, 1, 0, alpha=0.3))
    c.rect(50, y - 5, 350, 20, fill=1, stroke=0)
    c.setFillColor(black)
    c.drawString(55, y, "Este texto tiene un resaltado verde semitransparente.")
    y -= 60

    # Signature area
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Área de firma digital:")
    y -= 10

    # Draw signature box
    c.setStrokeColor(HexColor('#999999'))
    c.setDash(3, 3)  # Dashed border
    c.rect(50, y - 80, 250, 70, fill=0, stroke=1)
    c.setDash()  # Reset

    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor('#999999'))
    c.drawString(55, y - 75, "Firmar aquí")
    c.setFillColor(black)

    # Draw a fake signature (squiggly line)
    path = c.beginPath()
    path.moveTo(70, y - 40)
    for i in range(20):
        x = 70 + i * 10
        y_offset = math.sin(i * 0.8) * 12 + math.cos(i * 1.2) * 6
        path.lineTo(x, y - 40 + y_offset)
    c.setStrokeColor(HexColor('#1a237e'))
    c.setLineWidth(1.5)
    c.drawPath(path, stroke=1, fill=0)
    c.setLineWidth(1)

    y -= 120

    # Stamp annotation
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Sello / Stamp:")
    y -= 10

    # Draw a stamp
    c.saveState()
    c.setFillColor(Color(1, 0, 0, alpha=0.15))
    c.setStrokeColor(red)
    c.setLineWidth(3)
    c.roundRect(80, y - 60, 180, 50, 10, fill=1, stroke=1)

    c.setFillColor(red)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(170, y - 42, "APROBADO")
    c.restoreState()

    y -= 100

    # Watermark text
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(black)
    c.drawString(50, y, "Marca de agua (debería verse semitransparente):")

    c.saveState()
    c.setFillColor(Color(0.5, 0.5, 0.5, alpha=0.15))
    c.setFont("Helvetica-Bold", 60)
    c.translate(width / 2, y - 80)
    c.rotate(30)
    c.drawCentredString(0, 0, "BORRADOR")
    c.restoreState()

    c.showPage()

    # ============================================================
    # PAGE 4: Complex Vector Graphics
    # ============================================================
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 60, "Página 4: Gráficos Vectoriales")

    c.setFont("Helvetica", 11)
    c.drawString(50, height - 85, "Formas complejas, paths, y patrones geométricos.")

    y = height - 130

    # Complex geometric pattern
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Patrón geométrico con rotaciones:")
    y -= 20

    cx, cy = 200, y - 100
    c.saveState()
    for i in range(12):
        angle = i * 30
        c.saveState()
        c.translate(cx, cy)
        c.rotate(angle)
        alpha = 0.3 + (i / 12) * 0.5
        c.setFillColor(Color(0.2, 0.5, 0.9, alpha=alpha))
        c.setStrokeColor(Color(0.1, 0.3, 0.7))
        c.rect(-60, -10, 120, 20, fill=1, stroke=1)
        c.restoreState()
    c.restoreState()

    # Golden spiral approximation
    c.setFont("Helvetica-Bold", 13)
    c.drawString(350, y, "Espiral con arcos:")

    spiral_cx, spiral_cy = 450, y - 100
    c.setStrokeColor(HexColor('#d4af37'))
    c.setLineWidth(2)
    sizes = [80, 50, 31, 19, 12, 7, 4]
    angles = [0, 90, 180, 270, 0, 90, 180]
    for size in sizes:
        c.circle(spiral_cx, spiral_cy, size, fill=0, stroke=1)
        spiral_cx += size * 0.1
        spiral_cy += size * 0.05

    # Bezier curves
    y -= 240
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(black)
    c.drawString(50, y, "Curvas Bézier:")
    y -= 20

    c.setStrokeColor(HexColor('#e91e63'))
    c.setLineWidth(2)
    path = c.beginPath()
    path.moveTo(50, y - 50)
    path.curveTo(150, y + 30, 250, y - 130, 350, y - 50)
    c.drawPath(path, stroke=1, fill=0)

    c.setStrokeColor(HexColor('#4caf50'))
    path2 = c.beginPath()
    path2.moveTo(50, y - 50)
    path2.curveTo(100, y - 150, 300, y + 50, 450, y - 50)
    c.drawPath(path2, stroke=1, fill=0)

    c.setLineWidth(1)

    # Star polygon
    y -= 150
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Estrella (polígono complejo):")

    star_cx, star_cy = 170, y - 70
    star_r_outer = 50
    star_r_inner = 20
    points = 5

    path = c.beginPath()
    for i in range(points * 2):
        angle = math.pi / 2 + i * math.pi / points
        r = star_r_outer if i % 2 == 0 else star_r_inner
        px = star_cx + r * math.cos(angle)
        py = star_cy + r * math.sin(angle)
        if i == 0:
            path.moveTo(px, py)
        else:
            path.lineTo(px, py)
    path.close()
    c.setFillColor(Color(1, 0.84, 0, alpha=0.7))
    c.setStrokeColor(HexColor('#ff8f00'))
    c.setLineWidth(2)
    c.drawPath(path, stroke=1, fill=1)
    c.setLineWidth(1)

    c.showPage()

    # ============================================================
    # PAGE 5: Mixed content stress test
    # ============================================================
    c.setFont("Helvetica-Bold", 24)
    c.drawString(50, height - 60, "Página 5: Prueba de Estrés")

    c.setFont("Helvetica", 11)
    c.drawString(50, height - 85, "Muchos elementos superpuestos para probar el renderizado bajo presión.")

    # Draw many overlapping elements
    import random
    random.seed(42)  # Deterministic

    for i in range(80):
        x = random.randint(30, int(width) - 80)
        y_pos = random.randint(100, int(height) - 120)
        w = random.randint(20, 80)
        h = random.randint(20, 60)
        r = random.random()
        g = random.random()
        b_val = random.random()
        a = random.uniform(0.1, 0.5)

        c.setFillColor(Color(r, g, b_val, alpha=a))
        shape = random.choice(['rect', 'circle', 'roundrect'])
        if shape == 'rect':
            c.rect(x, y_pos, w, h, fill=1, stroke=0)
        elif shape == 'circle':
            c.circle(x, y_pos, w / 2, fill=1, stroke=0)
        else:
            c.roundRect(x, y_pos, w, h, 5, fill=1, stroke=0)

    # Add text on top
    c.setFillColor(Color(0, 0, 0, alpha=0.8))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, height / 2, "¿Se ve este texto sobre las figuras?")

    c.showPage()
    c.save()
    print(f"✅ PDF de prueba generado en: {OUTPUT}")
    print(f"   Tamaño: {os.path.getsize(OUTPUT) / 1024:.1f} KB")
    print(f"   Páginas: 5")
    print(f"   Contenido: Transparencias, Formularios, Anotaciones, Vectores, Estrés")

if __name__ == '__main__':
    create_test_pdf()
