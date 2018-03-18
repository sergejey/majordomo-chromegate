require.config({
    baseUrl: chrome.extension.getURL('js'),
    paths: {
        promise: 'lib/requirejs-promise',
        jquery: 'lib/jquery-3.2.1.min',
        jquerypubsub: 'lib/jquery.tiny-pubsub.js',
        underscore: 'lib/underscore-min',
        i18next: 'lib/i18n/i18next.min',
        jqueryI18next: 'lib/i18n/jquery-i18next.min',
        i18nextXHRBackend: 'lib/i18n/i18nextXHRBackend'
    }
});
