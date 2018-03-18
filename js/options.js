(function($) {
    require(
        ['underscore', 'jquery', 'TTS', 'util/Storage', 'util/i18n'],

        function(_, jquery, TTS, Storage, i18n) {

            TTS.getVoices();

            function save(items) {
                for (var key in items) {
                    localStorage[key] = items[key];
                }
                showMessage(i18n('settings.success'));
            }

            function showMessage(text) {
                showAlert(text, 'alert-success');
            }

            function showError(text) {
                showAlert(text, 'alert-danger');
            }

            function showAlert(text, className) {
                $('#message').empty().append('<div class="alert animated bounceInLeft ' + className +'" role="alert"><p class="lead">' + text +'</p></div>');
            }


            var app = $.sammy('#main', function() {
                this.use('Template');
                this.swap = function(content, callback) {
                    var ctx = this;
                    ctx.$element().fadeOut('slow', function() {
                        ctx.$element().html(content);
                        ctx.$element().fadeIn('slow', function() {
                            if (callback) {
                                callback.apply();
                            }
                        });
                        jquery(ctx.$element()).localize();
                    });
                };

                this.get('#/', function(ctx) {
                    ctx.redirect('#/settings');
                });

                this.get('#/settings', function(ctx) {
                    ctx.partial('template/settings.template',
                        {
                            name: Storage.local('name', i18n('settings.assistant.name.default')),
                            address: Storage.local('address', i18n('settings.address.default')),
                            ws_port: Storage.local('ws_port', i18n('settings.ws_port.default')),
                            terminal: Storage.local('terminal', i18n('settings.terminal.default')),
                            username: Storage.local('username', i18n('settings.username.default')),
                            server_auth: Storage.local('server_auth', i18n('settings.server_auth.default'))
                        },
                        function() {
                            $('#pitch').val(Storage.local('pitch', TTS.options));
                            $('#rate').val(Storage.local('rate', TTS.options));

                            var voice = Storage.local('voice');
                            var voice$ = $('#voice');
                            var optionN = $('<option></option>').text(i18n('settings.turnoff')).val('');
                            voice$.append(optionN);
                            TTS.getVoices().forEach(function(v) {
                                var option = $('<option></option>').text(v.name).val(v.name);
                                if (voice === v.name) option.attr('selected', 'selected');
                                voice$.append(option);
                            });
                        }
                    );
                    navigator.webkitGetUserMedia({audio: true}, function () {
                    }, function () {
                        showError(i18n('settings.blocked'));
                    });
                });

                this.post('#/settings', function(ctx) {
                    var name = $.trim(ctx.params['name']);
                    var address = $.trim(ctx.params['address']);
                    var ws_port = $.trim(ctx.params['ws_port']);
                    var terminal = $.trim(ctx.params['terminal']);
                    var username = $.trim(ctx.params['username']);
                    var server_auth = $.trim(ctx.params['server_auth']);
                    if (!address) {
                        showError(i18n('settings.address.empty'));
                    } else {
                        var changed = address !== Storage.local('address', i18n('settings.address.default'));
                        save({
                            name: name,
                            address: address,
                            ws_port: ws_port,
                            terminal: terminal,
                            username: username,
                            server_auth: server_auth,
                            pitch: ctx.params['pitch'],
                            rate: ctx.params['rate'],
                            voice: ctx.params['voice']
                        });
                        if (changed) {
                            chrome.runtime.sendMessage({init: true});
                        }
                    }
                });
            });

            jquery('body').localize();
            app.run('#/');
        }
    );
})(jQuery);