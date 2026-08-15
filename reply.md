Kontrol ettim, 2 dosyada lint hataları var:

1. **vehicle-type-selector.tsx**: Functions useEffect'ten önce kullanılıyor (hoisting issue) + unused import
2. **product-form.tsx**: Unescaped quotes in JSX (line 578)

Şimdi bu hataları fixleyip yeni commit pushlayacağım.
