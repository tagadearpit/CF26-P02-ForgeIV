"""Prepare the user-supplied college mark for a fixed cover-slide placement."""

from pathlib import Path

from PIL import Image


SOURCE = Path('/home/ubuntu/upload/Screenshot_2026_0824_231450.png')
OUTPUT = Path('/home/ubuntu/webdev-static-assets/ghraisoni-skilltech-nagpur-logo.png')


def main():
    image = Image.open(SOURCE).convert('RGB')
    # The source is a screenshot: crop away only the unused lower background
    # and the thin top capture edge while retaining the complete logo and line.
    logo = image.crop((220, 5, 505, 154))
    logo.save(OUTPUT, format='PNG', optimize=True)
    print(OUTPUT)


if __name__ == '__main__':
    main()
