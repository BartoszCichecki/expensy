// Translations. English is the base language; every key must exist in `en`.
// Missing keys in other languages fall back to English.
//
// Usage:  t('list.current')                      → "Current list"
//         t('list.since', { count, date })       → placeholders in {braces}
//         tc('count.expenses', 5)                → plural form chosen with Intl.PluralRules
//
// To add a language: copy the `pl` block, translate it, and add it to LANGUAGES.
import { loadPref, savePref } from './storage.js';

const en = {
  nav: { list: 'Expenses', stats: 'Stats', archive: 'Archive', settings: 'Settings' },
  common: {
    cancel: 'Cancel', save: 'Save', delete: 'Delete', close: 'Close', reload: 'Reload',
    restore: 'Restore', edit: 'Edit', somethingWrong: 'Something went wrong.',
  },
  count: {
    expenses: { one: '{n} expense', other: '{n} expenses' },
    settlements: { one: '{n} settlement', other: '{n} settlements' },
  },
  date: { today: 'Today', yesterday: 'Yesterday' },
  keypad: { backspace: 'Delete digit' },
  maps: { openIn: 'Open in', apple: 'Apple Maps', google: 'Google Maps', ask: 'Ask each time', remember: 'Remember on this device', setting: 'Maps app' },
  categories: {
    food: 'Food', groceries: 'Groceries', transport: 'Transport', fuel: 'Fuel', home: 'Home', bills: 'Bills',
    health: 'Health', entertainment: 'Entertainment', travel: 'Travel', clothes: 'Clothes', gifts: 'Gifts',
    other: 'Other', // expenses without a category
  },
  list: {
    current: 'Current list',
    add: 'Add expense',
    since: '{count} · since {date}',
    noExpenses: 'No expenses',
    settle: 'Settle up',
    emptyState: 'The list is empty.<br>Add your first expense with the <b>Add expense</b> button.',
  },
  settle: {
    title: 'Settle up',
    summary: {
      one: '{n} expense totalling {amount} will move to the archive and the current list will be cleared.',
      other: '{n} expenses totalling {amount} will move to the archive and the current list will be cleared.',
    },
    name: 'Settlement name',
    confirm: 'Settle up',
    done: 'Moved to the archive',
    undo: 'Undo',
  },
  stats: {
    title: 'Stats', current: 'Current list', all: 'All time',
    total: 'Total', count: 'Expenses', average: 'Average expense', perDay: 'Average per day', biggest: 'Largest',
    categories: 'Categories',
    multiCategoryNote: 'Expenses with several categories count in full in each of them.',
    daily: 'Daily spending', monthly: 'Monthly spending',
    tapHint: 'Tap a bar to see the amount', noData: 'No data yet.',
  },
  archive: {
    title: 'Archive',
    emptyState: 'Nothing here yet.<br>Settled lists will show up here.',
    summary: '{count} · {amount} in total',
    settledOn: 'Settled {date}',
    rename: 'Rename',
    showStats: 'Stats',
    reopenTitle: 'Move back to the current list?',
    reopenMessage: {
      one: '{n} expense will go back to the current list and this settlement will be removed from the archive.',
      other: '{n} expenses will go back to the current list and this settlement will be removed from the archive.',
    },
    reopened: 'Moved back to the current list',
    deleteTitle: 'Delete settlement?',
    deleteMessage: '“{name}” ({count}) will be permanently deleted together with its photos. This cannot be undone.',
    deleteConfirm: 'Delete permanently',
    deleted: 'Settlement deleted',
  },
  form: {
    newTitle: 'New expense', editTitle: 'Edit expense',
    amount: 'Amount', note: 'Note (optional)', dateTime: 'Date and time',
    photo: 'Photo', photoOptional: 'Photo (optional)', photoPreview: 'Photo preview', removePhoto: 'Remove photo',
    add: 'Add', change: 'Change',
    photoTooLarge: 'The photo is too large (max 10 MB).',
    invalidAmount: 'Enter a valid amount, e.g. 12.50',
    added: 'Expense added',
    photoFailed: 'Expense saved, but the photo was not: {error}',
    viewTitle: 'Expense',
    currency: 'Currency',
    rate: '1 {from} = {rate} {to} ({date})',
    rateUnavailable: 'No exchange rate right now — enter the amount in {currency}.',
    deleteTitle: 'Delete expense?', deleteMessage: 'This cannot be undone.', deleted: 'Expense deleted',
  },
  location: {
    pending: 'Getting location…', skip: 'Skip', map: 'Map', remove: 'Remove', removeLabel: 'Remove location',
    retry: 'Retry', none: 'No location', add: 'Add',
    unsupported: 'Location not supported', denied: 'Location permission denied',
    needsHttps: 'Location requires HTTPS', failed: 'Couldn’t get location',
  },
  settings: {
    title: 'Settings',
    language: 'Language', languageAuto: 'Automatic',
    currency: 'Currency', currencySaved: 'Currency: {currency}',
    categories: 'Categories', addCategory: '+ Add category', archived: 'Archived ({n})',
    moveUp: 'Move up', moveDown: 'Move down',
    data: 'Data', exportAll: 'Export everything to CSV',
    install: 'Add to home screen',
    madeWith: 'Made with ❤️ in 🇵🇱 & 🇩🇰',
    installHelp: '<b>iPhone (Safari):</b> Share → “Add to Home Screen”.<br><b>Android (Chrome):</b> menu ⋮ → “Install app” / “Add to Home screen”.',
  },
  account: {
    title: 'Account',
    username: 'login: {username}',
    displayName: 'Display name',
    displayNameOptional: 'Display name (optional)',
    displayNameHint: 'How the app shows you, e.g. “Bartek”. Leave empty to use your login.',
    editName: 'Edit name',
    nameSaved: 'Name saved',
    changePassword: 'Change password',
    currentPassword: 'Current password',
    newPassword: 'New password',
    passwordChanged: 'Password changed',
    logout: 'Log out',
    logoutOthers: 'Log out other devices',
    logoutOthersTitle: 'Log out other devices?',
    logoutOthersMessage: 'Every other phone or computer signed in to your account will need to log in again. This device stays logged in.',
    loggedOutOthers: 'Other devices logged out',
  },
  users: {
    title: 'Users',
    admin: 'Admin',
    inactive: 'Deactivated',
    add: '+ Add user',
    addTitle: 'New user',
    addIntro: 'They’ll have their own expense list. You manage accounts but don’t see their expenses.',
    create: 'Create',
    created: 'User {name} created',
    hint: 'Each user has their own list and archive. Categories and currency are shared; only you can change them.',
    resetPassword: 'Reset password',
    resetTitle: 'New password for {name}',
    resetIntro: 'They will be logged out on all their devices.',
    passwordReset: 'Password changed',
    deactivate: 'Deactivate',
    deactivateTitle: 'Deactivate {name}?',
    deactivateMessage: 'They will be logged out and won’t be able to log in. Their expenses stay. You can activate them again at any time.',
    deactivated: 'User deactivated',
    activate: 'Activate',
    activated: 'User activated',
  },
  category: {
    newTitle: 'New category', editTitle: 'Edit category',
    icon: 'Icon', customIcon: 'Any other emoji', name: 'Name', color: 'Colour',
    archive: 'Archive',
    default: 'Default',
    defaultHint: 'Pre-selected when adding an expense',
    archiveTitle: 'Archive category “{name}”?',
    archiveMessage: 'It will be hidden when adding expenses, but existing expenses keep it. You can restore or delete it later.',
    archived: 'Category archived',
    restored: 'Category restored',
    deleteTitle: 'Delete category “{name}”?',
    deleteMessage: 'Expenses lose this category; those left without any will show as “Other”. This can’t be undone.',
    deleted: 'Category deleted',
  },
  login: {
    prompt: 'Log in to continue.',
    username: 'Username', password: 'Password', repeatPassword: 'Repeat password',
    passwordsDiffer: 'The passwords don’t match.',
    submit: 'Log in',
  },
  setup: {
    title: 'Welcome to Expensy',
    prompt: 'Create the admin account. You’ll be able to add more users later in Settings.',
    submit: 'Create account',
  },
  errors: {
    network: 'Can’t reach the server.',
    reauth: 'Please log in again.',
    server: 'Server error ({status}).',
    tooLarge: 'The file is too large.',
    tooMany: 'Too many attempts. Try again in a minute.',
    // codes returned by the API
    amount_invalid: 'Enter an amount greater than zero.',
    note_too_long: 'The note can be at most 500 characters.',
    date_invalid: 'Invalid date.',
    location_invalid: 'Invalid location.',
    category_not_found: 'That category doesn’t exist.',
    too_many_categories: 'An expense can have at most 10 categories.',
    rate_unavailable: 'The exchange rate isn’t available right now.',
    photo_invalid: 'Unsupported photo (JPEG, PNG, WebP, HEIC or GIF, max 10 MB).',
    category_name_invalid: 'Category name must be 1–40 characters.',
    category_not_archived: 'Archive the category before deleting it.',
    category_icon_invalid: 'The icon should be a single emoji.',
    category_color_invalid: 'Invalid colour.',
    settle_empty: 'The list is empty — nothing to settle.',
    settlement_name_invalid: 'Name must be 1–100 characters.',
    currency_invalid: 'Unsupported currency.',
    login_invalid: 'Wrong username or password.',
    setup_done: 'The admin account already exists. Log in instead.',
    username_invalid: 'Username: 1–32 letters, digits, “.”, “_” or “-”.',
    username_taken: 'That username is already taken.',
    password_length: 'The password must be 8–64 characters long.',
    display_name_invalid: 'The display name can be at most 50 characters.',
    current_password_invalid: 'The current password is wrong.',
    admin_only: 'Only the admin can do this.',
    cannot_deactivate_self: 'You can’t deactivate your own account.',
    csrf: 'The request was blocked. Reload the app and try again.',
  },
};

const pl = {
  nav: { list: 'Wydatki', stats: 'Statystyki', archive: 'Archiwum', settings: 'Ustawienia' },
  common: {
    cancel: 'Anuluj', save: 'Zapisz', delete: 'Usuń', close: 'Zamknij', reload: 'Odśwież',
    restore: 'Przywróć', edit: 'Edytuj', somethingWrong: 'Coś poszło nie tak.',
  },
  count: {
    expenses: { one: '{n} wydatek', few: '{n} wydatki', many: '{n} wydatków', other: '{n} wydatku' },
    settlements: { one: '{n} rozliczenie', few: '{n} rozliczenia', many: '{n} rozliczeń', other: '{n} rozliczenia' },
  },
  date: { today: 'Dziś', yesterday: 'Wczoraj' },
  keypad: { backspace: 'Usuń cyfrę' },
  maps: { openIn: 'Otwórz w', apple: 'Apple Maps', google: 'Google Maps', ask: 'Pytaj za każdym razem', remember: 'Zapamiętaj na tym urządzeniu', setting: 'Aplikacja map' },
  categories: {
    food: 'Jedzenie', groceries: 'Zakupy', transport: 'Transport', fuel: 'Paliwo', home: 'Dom', bills: 'Rachunki',
    health: 'Zdrowie', entertainment: 'Rozrywka', travel: 'Podróże', clothes: 'Ubrania', gifts: 'Prezenty',
    other: 'Inne',
  },
  list: {
    current: 'Bieżąca lista',
    add: 'Dodaj wydatek',
    since: '{count} · od {date}',
    noExpenses: 'Brak wydatków',
    settle: 'Rozlicz',
    emptyState: 'Lista jest pusta.<br>Dodaj pierwszy wydatek przyciskiem <b>Dodaj wydatek</b>.',
  },
  settle: {
    title: 'Rozlicz listę',
    summary: {
      one: 'Do archiwum trafi {n} wydatek na kwotę {amount}, a bieżąca lista zostanie wyczyszczona.',
      few: 'Do archiwum trafią {n} wydatki na kwotę {amount}, a bieżąca lista zostanie wyczyszczona.',
      many: 'Do archiwum trafi {n} wydatków na kwotę {amount}, a bieżąca lista zostanie wyczyszczona.',
      other: 'Do archiwum trafi {n} wydatku na kwotę {amount}, a bieżąca lista zostanie wyczyszczona.',
    },
    name: 'Nazwa rozliczenia',
    confirm: 'Rozlicz',
    done: 'Przeniesiono do archiwum',
    undo: 'Cofnij',
  },
  stats: {
    title: 'Statystyki', current: 'Bieżąca lista', all: 'Od początku',
    total: 'Suma', count: 'Liczba wydatków', average: 'Średni wydatek', perDay: 'Średnio dziennie', biggest: 'Największy',
    categories: 'Kategorie',
    multiCategoryNote: 'Wydatki z kilkoma kategoriami liczą się w całości w każdej z nich.',
    daily: 'Wydatki dziennie', monthly: 'Wydatki miesięcznie',
    tapHint: 'Dotknij słupka, aby zobaczyć kwotę', noData: 'Brak danych do statystyk.',
  },
  archive: {
    title: 'Archiwum',
    emptyState: 'Nic tu jeszcze nie ma.<br>Rozliczone listy pojawią się w tym miejscu.',
    summary: '{count} · łącznie {amount}',
    settledOn: 'Rozliczono {date}',
    rename: 'Zmień nazwę',
    showStats: 'Statystyki',
    reopenTitle: 'Przywrócić do bieżącej listy?',
    reopenMessage: {
      one: '{n} wydatek wróci na bieżącą listę, a to rozliczenie zniknie z archiwum.',
      few: '{n} wydatki wrócą na bieżącą listę, a to rozliczenie zniknie z archiwum.',
      many: '{n} wydatków wróci na bieżącą listę, a to rozliczenie zniknie z archiwum.',
      other: '{n} wydatku wróci na bieżącą listę, a to rozliczenie zniknie z archiwum.',
    },
    reopened: 'Przywrócono do bieżącej listy',
    deleteTitle: 'Usunąć rozliczenie?',
    deleteMessage: 'Rozliczenie „{name}” ({count}) zostanie trwale usunięte razem ze zdjęciami. Tej operacji nie można cofnąć.',
    deleteConfirm: 'Usuń trwale',
    deleted: 'Usunięto rozliczenie',
  },
  form: {
    newTitle: 'Nowy wydatek', editTitle: 'Edytuj wydatek',
    amount: 'Kwota', note: 'Notatka (opcjonalnie)', dateTime: 'Data i godzina',
    photo: 'Zdjęcie', photoOptional: 'Zdjęcie (opcjonalnie)', photoPreview: 'Podgląd zdjęcia', removePhoto: 'Usuń zdjęcie',
    add: 'Dodaj', change: 'Zmień',
    photoTooLarge: 'Zdjęcie jest za duże (maks. 10 MB).',
    invalidAmount: 'Podaj poprawną kwotę, np. 12,50',
    added: 'Dodano wydatek',
    photoFailed: 'Wydatek zapisany, ale zdjęcie nie: {error}',
    viewTitle: 'Wydatek',
    currency: 'Waluta',
    rate: '1 {from} = {rate} {to} ({date})',
    rateUnavailable: 'Brak kursu wymiany — wpisz kwotę w {currency}.',
    deleteTitle: 'Usunąć wydatek?', deleteMessage: 'Tej operacji nie można cofnąć.', deleted: 'Usunięto wydatek',
  },
  location: {
    pending: 'Ustalam lokalizację…', skip: 'Pomiń', map: 'Mapa', remove: 'Usuń', removeLabel: 'Usuń lokalizację',
    retry: 'Ponów', none: 'Bez lokalizacji', add: 'Dodaj',
    unsupported: 'Lokalizacja nieobsługiwana', denied: 'Brak zgody na lokalizację',
    needsHttps: 'Lokalizacja wymaga HTTPS', failed: 'Nie udało się ustalić lokalizacji',
  },
  settings: {
    title: 'Ustawienia',
    language: 'Język', languageAuto: 'Automatyczny',
    currency: 'Waluta', currencySaved: 'Waluta: {currency}',
    categories: 'Kategorie', addCategory: '+ Dodaj kategorię', archived: 'Zarchiwizowane ({n})',
    moveUp: 'W górę', moveDown: 'W dół',
    data: 'Dane', exportAll: 'Eksportuj wszystko do CSV',
    install: 'Dodaj do ekranu głównego',
    madeWith: 'Zrobione z ❤️ w 🇵🇱 i 🇩🇰',
    installHelp: '<b>iPhone (Safari):</b> Udostępnij → „Do ekranu początkowego”.<br><b>Android (Chrome):</b> menu ⋮ → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”.',
  },
  account: {
    title: 'Konto',
    username: 'login: {username}',
    displayName: 'Nazwa wyświetlana',
    displayNameOptional: 'Nazwa wyświetlana (opcjonalnie)',
    displayNameHint: 'Tak aplikacja będzie cię pokazywać, np. „Bartek”. Zostaw puste, żeby używać loginu.',
    editName: 'Zmień nazwę',
    nameSaved: 'Nazwa zapisana',
    changePassword: 'Zmień hasło',
    currentPassword: 'Obecne hasło',
    newPassword: 'Nowe hasło',
    passwordChanged: 'Hasło zmienione',
    logout: 'Wyloguj',
    logoutOthers: 'Wyloguj inne urządzenia',
    logoutOthersTitle: 'Wylogować inne urządzenia?',
    logoutOthersMessage: 'Każdy inny telefon lub komputer zalogowany na twoje konto będzie musiał zalogować się ponownie. To urządzenie pozostanie zalogowane.',
    loggedOutOthers: 'Wylogowano inne urządzenia',
  },
  users: {
    title: 'Użytkownicy',
    admin: 'Admin',
    inactive: 'Nieaktywny',
    add: '+ Dodaj użytkownika',
    addTitle: 'Nowy użytkownik',
    addIntro: 'Będzie mieć własną listę wydatków. Zarządzasz kontami, ale nie widzisz cudzych wydatków.',
    create: 'Utwórz',
    created: 'Utworzono użytkownika {name}',
    hint: 'Każdy ma własną listę i archiwum. Kategorie i waluta są wspólne i tylko ty możesz je zmieniać.',
    resetPassword: 'Zresetuj hasło',
    resetTitle: 'Nowe hasło dla {name}',
    resetIntro: 'Użytkownik zostanie wylogowany na wszystkich urządzeniach.',
    passwordReset: 'Hasło zmienione',
    deactivate: 'Dezaktywuj',
    deactivateTitle: 'Dezaktywować {name}?',
    deactivateMessage: 'Użytkownik zostanie wylogowany i nie będzie mógł się zalogować. Jego wydatki zostaną. Możesz go w każdej chwili aktywować ponownie.',
    deactivated: 'Użytkownik dezaktywowany',
    activate: 'Aktywuj',
    activated: 'Użytkownik aktywowany',
  },
  category: {
    newTitle: 'Nowa kategoria', editTitle: 'Edytuj kategorię',
    icon: 'Ikona', customIcon: 'Dowolne inne emoji', name: 'Nazwa', color: 'Kolor',
    archive: 'Zarchiwizuj',
    default: 'Domyślna',
    defaultHint: 'Zaznaczona od razu przy dodawaniu wydatku',
    archiveTitle: 'Zarchiwizować kategorię „{name}”?',
    archiveMessage: 'Zniknie z wyboru przy dodawaniu wydatków, ale istniejące wydatki ją zachowają. Później możesz ją przywrócić albo usunąć.',
    archived: 'Kategoria zarchiwizowana',
    restored: 'Kategoria przywrócona',
    deleteTitle: 'Usunąć kategorię „{name}”?',
    deleteMessage: 'Wydatki stracą tę kategorię, a te bez żadnej innej będą widoczne jako „Inne”. Tego nie da się cofnąć.',
    deleted: 'Kategoria usunięta',
  },
  login: {
    prompt: 'Zaloguj się, aby kontynuować.',
    username: 'Nazwa użytkownika', password: 'Hasło', repeatPassword: 'Powtórz hasło',
    passwordsDiffer: 'Hasła się różnią.',
    submit: 'Zaloguj',
  },
  setup: {
    title: 'Witaj w Expensy',
    prompt: 'Utwórz konto administratora. Kolejnych użytkowników dodasz później w Ustawieniach.',
    submit: 'Utwórz konto',
  },
  errors: {
    network: 'Brak połączenia z serwerem.',
    reauth: 'Zaloguj się ponownie.',
    server: 'Błąd serwera ({status}).',
    tooLarge: 'Plik jest za duży.',
    tooMany: 'Za dużo prób. Spróbuj za minutę.',
    amount_invalid: 'Podaj kwotę większą od zera.',
    note_too_long: 'Notatka może mieć maksymalnie 500 znaków.',
    date_invalid: 'Nieprawidłowa data.',
    location_invalid: 'Nieprawidłowa lokalizacja.',
    category_not_found: 'Nie ma takiej kategorii.',
    too_many_categories: 'Wydatek może mieć maksymalnie 10 kategorii.',
    rate_unavailable: 'Kurs wymiany jest teraz niedostępny.',
    photo_invalid: 'Nieobsługiwane zdjęcie (JPEG, PNG, WebP, HEIC lub GIF, maks. 10 MB).',
    category_name_invalid: 'Nazwa kategorii musi mieć od 1 do 40 znaków.',
    category_not_archived: 'Najpierw zarchiwizuj kategorię, potem ją usuń.',
    category_icon_invalid: 'Ikona powinna być pojedynczym emoji.',
    category_color_invalid: 'Nieprawidłowy kolor.',
    settle_empty: 'Lista jest pusta — nie ma czego rozliczać.',
    settlement_name_invalid: 'Nazwa musi mieć od 1 do 100 znaków.',
    currency_invalid: 'Nieobsługiwana waluta.',
    login_invalid: 'Nieprawidłowa nazwa użytkownika lub hasło.',
    setup_done: 'Konto administratora już istnieje. Zaloguj się.',
    username_invalid: 'Nazwa użytkownika: 1–32 litery, cyfry, „.”, „_” lub „-”.',
    username_taken: 'Ta nazwa użytkownika jest już zajęta.',
    password_length: 'Hasło musi mieć od 8 do 64 znaków.',
    display_name_invalid: 'Nazwa wyświetlana może mieć maksymalnie 50 znaków.',
    current_password_invalid: 'Obecne hasło jest nieprawidłowe.',
    admin_only: 'Tylko administrator może to zrobić.',
    cannot_deactivate_self: 'Nie możesz dezaktywować własnego konta.',
    csrf: 'Żądanie zostało zablokowane. Odśwież aplikację i spróbuj ponownie.',
  },
};

/** Available languages: code → { name shown in the picker, dictionary }. */
export const LANGUAGES = {
  en: { name: 'English', dict: en },
  pl: { name: 'Polski', dict: pl },
};

const LANGUAGE_PREF = 'expensy.language';

/**
 * A language code, or 'auto' for the device's language — the user's choice on this device; English until they pick.
 * Changing it needs a reload.
 */
export const getLanguagePreference = () => loadPref(LANGUAGE_PREF, 'en');
export const setLanguagePreference = (value) => savePref(LANGUAGE_PREF, value);

function detectLanguage() {
  const pref = getLanguagePreference();
  if (LANGUAGES[pref]) return pref;
  // 'auto': the first of the device's languages that the app has
  for (const tag of navigator.languages ?? [navigator.language]) {
    const code = tag?.slice(0, 2).toLowerCase();
    if (LANGUAGES[code]) return code;
  }
  return 'en';
}

/** Current language code ('en' | 'pl'). Changing it requires a reload. */
export const lang = detectLanguage();

/** BCP-47 locale used for number and date formatting. */
export const locale = lang === 'pl'
  ? 'pl-PL'
  : (navigator.language?.toLowerCase().startsWith('en') ? navigator.language : 'en-GB');

const lookup = (dict, key) => key.split('.').reduce((node, part) => node?.[part], dict);
const fill = (text, params) => text.replace(/\{(\w+)\}/g, (m, name) => (name in params ? params[name] : m));

/** Translates a key; returns the key itself if it's missing everywhere (makes typos visible). */
export function t(key, params = {}) {
  const value = lookup(LANGUAGES[lang].dict, key) ?? lookup(en, key);
  return typeof value === 'string' ? fill(value, params) : key;
}

/** True if a translation exists for the key (used for API error codes). */
export const has = (key) => typeof (lookup(LANGUAGES[lang].dict, key) ?? lookup(en, key)) === 'string';

const pluralRules = new Intl.PluralRules(locale);

/** Plural-aware translation: tc('count.expenses', 3) → "3 expenses" / "3 wydatki". */
export function tc(key, n, params = {}) {
  const forms = lookup(LANGUAGES[lang].dict, key) ?? lookup(en, key) ?? {};
  const text = forms[pluralRules.select(n)] ?? forms.other ?? key;
  return fill(text, { n, ...params });
}

/** Translates static HTML: elements with data-i18n="key" get their text, data-i18n-label="key" their aria-label. */
export function translateDocument(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nLabel)));
}
