/**
 * Determine if it should be dark mode based on local time.
 * Dark mode: 6 PM (18:00) to 6 AM (06:00)
 */
export function shouldBeDark() {
    const hour = new Date().getHours();
    return hour >= 18 || hour < 6;
}

/**
 * Language translations for the app.
 */
const translations = {
    en: {
        searchPlaceholder: 'Search places, addresses...',
        directions: 'Directions',
        directionsTitle: 'Directions',
        chooseOrigin: 'Choose starting point, or click on map',
        chooseDestination: 'Choose destination',
        driving: 'Driving',
        walking: 'Walking',
        cycling: 'Cycling',
        myLocation: 'My location',
        yourLocation: 'Your location',
        useGPS: 'Use GPS',
        mapLayers: 'Map layers',
        mapType: 'Map Type',
        darkMode: 'Toggle dark mode',
        streets: 'Streets',
        satellite: 'Satellite',
        terrain: 'Terrain',
        dark: 'Dark',
        share: 'Share',
        clear: 'Clear',
        close: 'Close',
        findingLocation: 'Finding your location...',
        youAreHere: 'You are here',
        origin: 'Origin',
        destination: 'Destination',
        startTrip: 'Start your trip',
        arrived: 'You have arrived',
        zoomIn: 'Zoom in',
        zoomOut: 'Zoom out',
        droppedPin: 'Dropped Pin',
        swap: 'Swap origin and destination',
        language: 'En',
        languageLabel: 'العربية',
    },
    ar: {
        searchPlaceholder: 'ابحث عن أماكن، عناوين...',
        directions: 'الاتجاهات',
        directionsTitle: 'الاتجاهات',
        chooseOrigin: 'اختر نقطة البداية، أو انقر على الخريطة',
        chooseDestination: 'اختر الوجهة',
        driving: 'قيادة',
        walking: 'مشي',
        cycling: 'دراجة',
        myLocation: 'موقعي',
        yourLocation: 'موقعك',
        useGPS: 'استخدم GPS',
        mapLayers: 'طبقات الخريطة',
        mapType: 'نوع الخريطة',
        darkMode: 'الوضع الليلي',
        streets: 'شوارع',
        satellite: 'قمر صناعي',
        terrain: 'تضاريس',
        dark: 'داكن',
        share: 'مشاركة',
        clear: 'مسح',
        close: 'إغلاق',
        findingLocation: 'جاري تحديد موقعك...',
        youAreHere: 'أنت هنا',
        origin: 'نقطة البداية',
        destination: 'الوجهة',
        startTrip: 'ابدأ رحلتك',
        arrived: 'لقد وصلت',
        zoomIn: 'تكبير',
        zoomOut: 'تصغير',
        droppedPin: 'دبوس',
        swap: 'تبديل البداية والوجهة',
        language: 'Ar',
        languageLabel: 'English',
    },
};

export function getTranslations(lang) {
    return translations[lang] || translations.en;
}

export function getDirection(lang) {
    return lang === 'ar' ? 'rtl' : 'ltr';
}
