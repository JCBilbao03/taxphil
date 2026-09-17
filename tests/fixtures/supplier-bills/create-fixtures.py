"""Fictional invoices for PDF text extraction and browser OCR acceptance tests."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import ImageReader
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
lines = [
 'Metro Office Supply',
 'TIN: 321-654-987-00000',
 'Address: 100 Sample Avenue, Makati City',
 'SALES INVOICE',
 'Invoice No: TEST-PDF-002',
 'Invoice Date: September 15, 2026',
 'Due Date: September 30, 2026',
 'Currency: PHP',
 'Bill To: Mabuhay Trading, Inc.',
 'Customer TIN: 123-456-789-00000',
 'Customer Address: 200 Demo Road, Makati City',
 'Description: Office stationery and printer paper',
 'VATable Sales: PHP 2,000.00',
 'VAT Amount: PHP 240.00',
 'Grand Total: PHP 2,240.00',
 'FICTIONAL TEST DOCUMENT - NOT FOR TAX FILING',
]
c = canvas.Canvas(str(root / 'text-invoice.pdf'), pagesize=(612,792), invariant=1)
c.setTitle('Fictional supplier invoice for tests')
y=742
for i,line in enumerate(lines):
 c.setFont('Helvetica-Bold' if i in [0,3,14] else 'Helvetica', 16 if i==0 else 11)
 c.setFillColor(HexColor('#17324d'))
 c.drawString(48,y,line)
 y -= 40 if i in [2,7,10,14] else 26
c.save()
# Independent raster-only PDF: it must contain no hidden text layer.
image=Image.new('RGB',(1530,1980),'white'); draw=ImageDraw.Draw(image)
font_path='/System/Library/Fonts/Supplemental/Arial.ttf'
font=ImageFont.truetype(font_path,28);bold=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf',38)
y=125
for i,line in enumerate(lines):
 line=line.replace('TEST-PDF-002','TEST-SCAN-003')
 draw.text((120,y),line,fill='#17324d',font=bold if i==0 else font)
 y += 100 if i in [2,7,10,14] else 65
c=canvas.Canvas(str(root/'scanned-invoice.pdf'),pagesize=(612,792),invariant=1)
c.setTitle('Fictional scanned supplier invoice for tests')
c.drawImage(ImageReader(image),0,0,width=612,height=792);c.save()
image.save('/private/tmp/taxphil-scanned-invoice.png')
