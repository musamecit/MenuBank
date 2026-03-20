QRMenu projesinde Metro build hatası: "react" modülü @types/react paketine çözümleniyor, build kırılıyor.
Yapılacaklar:
1. Root package.json: devDependencies ve overrides bölümlerini tamamen kaldır
2. mobile/tsconfig.json: paths içinde sadece "@/*": ["src/*"] kalsın. "react", "react-native", "@shopify/flash-list" silinsin
3. npm install && cd mobile && npx expo export --platform ios ile doğrula
