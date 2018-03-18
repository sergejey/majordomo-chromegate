require(
    ['underscore', 'Recognizer', 'TTS', 'util/Storage', 'util/i18n'],
    function (_, Recognizer, TTS, Storage, i18n) {
        var options, listening;
        var beep = new Audio('beep.mp3');
        var wsTimer = 0;
        var askTimer = 0;
        var isAsking = 0;
        var wsSocket;
        var startedWebSockets = 0;
        var justSaid = '';

        var rec = new Recognizer(
            {
                result: recognized,
                partial: partial,
                error: onRecognizerError
            }
        );

        var tts = new TTS({complete: listen});

        chrome.runtime.onMessage.addListener(function (request) {
            if (request.init === true) {
                init();
            }
        });

        init();
        listen();

        function wsConnected() {
            var payload = new Object();
            payload.action = 'Subscribe';
            payload.data = new Object();
            payload.data.TYPE = 'events';
            payload.data.EVENTS = 'SAY,SAYTO,ASK';
            console.log('Subscribing to ' + payload.data.EVENTS);
            wsSocket.send(JSON.stringify(payload));
        }

        function startWebSockets() {
            var loc = window.location, new_uri;
            var serverUrl = '';
            if (loc.protocol === "https:") {
                serverUrl = "wss:";
            } else {
                serverUrl = "ws:";
            }
            var baseAddress = Storage.local('address', i18n('settings.address.default'));
            var basePort =  Storage.local('ws_port', i18n('settings.ws_port.default'));
            /*
            if (baseAddress.indexOf(':') == -1) {
                baseAddress = baseAddress + ':8001';
            }
            */
            serverUrl += "//" + baseAddress + ':' + basePort + '/majordomo';
            try {
                if (window.MozWebSocket) {
                    wsSocket = new MozWebSocket(serverUrl);
                } else if (window.WebSocket) {
                    wsSocket = new WebSocket(serverUrl);
                }

            } catch (e) {
                return false;
            }
            wsSocket.binaryType = 'blob';
            wsSocket.onopen = function (msg) {
                ///connected
                startedWebSockets = 1;
                clearTimeout(wsTimer);
                console.log('WS connected (' + serverUrl + ')');
                wsConnected();
            };
            wsSocket.onmessage = function (msg) {
                console.log('WS data (' + serverUrl + ')');
                var response;
                var message = '';
                response = JSON.parse(msg.data);
                console.log('Action:' + response.action);
                if (response.action == 'events') {
                    console.log(response);
                    var event_data = JSON.parse(response.data);
                    if (event_data.EVENT_DATA.NAME == 'ASK') {
                        var promptLine = event_data.EVENT_DATA.VALUE.prompt;
                        var target = event_data.EVENT_DATA.VALUE.target;
                        target = target.toUpperCase();
                        var terminal = Storage.local('terminal', i18n('settings.terminal.default'));
                        terminal = terminal.toUpperCase();
                        if (terminal == target || target == '' || target == '*') {
                            isAsking=1;
                            clearTimeout(askTimer);
                            askTimer = setTimeout('isAsking=0;',15*1000);
                            beep.play();
                            if (promptLine!='') {
                                message = promptLine;
                            }
                        }
                    }
                    if (event_data.EVENT_DATA.NAME == 'SAY') {
                        message = event_data.EVENT_DATA.VALUE.message;
                        if (message == justSaid) {
                            message = '';
                        }
                    }
                    if (event_data.EVENT_DATA.NAME == 'SAYTO') {
                        message = event_data.EVENT_DATA.VALUE.message;
                        var destination = event_data.EVENT_DATA.VALUE.destination;
                        destination = destination.toUpperCase();
                        var terminal = Storage.local('terminal', i18n('settings.terminal.default'));
                        terminal = terminal.toUpperCase();
                        if (destination == terminal) {
                            console.log('Sayto action processed');
                            justSaid = message;
                        } else {
                            message = '';
                        }
                    }
                }
                //console.log(event_data);
                //console.log(message);
                if (message != '') {
                    notify(message);
                    say(message);
                }

                //$.publish('wsData', response);
                return;
            };
            wsSocket.onclose = function (msg) {
                //disconnected
                startedWebSockets = 0;
                wsTimer = setTimeout(startWebSockets, 5 * 1000);
                //$.publish('wsDisconnected', []);
                console.log('WS disconnected (' + serverUrl + ')');
                return;
            };
            return true;
        }


        function listen() {
            rec.start();
        }

        function onRecognizerError(error) {
            if (error === 'no-speech') {
                //listen();
            } else if (error === 'audio-capture') {
                notify({text: i18n('settings.blocked')});
            } else if (error === 'not-allowed') {
                if (!options) {
                    options = true;
                    chrome.runtime.openOptionsPage();
                }
            }
        }

        function recognized(result) {
            if (tts && tts.isSpeaking()) return;
            console.log('Recognized: ' + result);
            var input = getCommand(result);
            if (input) {
                isAsking = 0;
                beep.play();
                process(input);
            }
            listen();
        }

        function partial(result) {
        }

        function getCommand(text) {
            if (!text) return '';
            if (listening) return text;
            var cmd = text;
            var name = Storage.local('name', '');
            text = text.toLowerCase();
            if (!name || isAsking == 1) return cmd;

            var pos = text.indexOf(name.toLowerCase());
            if (pos === -1 || text.length === name.length) return '';
            return cmd.substring(pos + name.length + 1);
        }

        function process(input) {
            listening = false;
            if (startedWebSockets) {
                //eventBus.send('asr.result', input);
                console.log('Sending to WS: ' + input);
            } else {
                //init(_.partial(process, input));
            }
            var serverUrl = "http://" + Storage.local('address', i18n('settings.address.default')) + '/command.php?qry=' + encodeURIComponent(input) + '&terminal=' + Storage.local('terminal', i18n('settings.terminal.default')) + '&username=' + Storage.local('username', i18n('settings.username.default'));

            var server_auth = Storage.local('server_auth', i18n('settings.server_auth.default'));

            if (server_auth !='') {
                //console.log("Trying with server auth: "+server_auth);
                $.ajax({
                    url: serverUrl,
                    headers: {
                        "Authorization": "Basic " + btoa(server_auth)
                    },
                }).done(function (data) {
                    console.log('Returned: ' + data);
                });
            } else {
                $.ajax({
                    url: serverUrl
                }).done(function (data) {
                    console.log('Returned: ' + data);
                });
            }


        }

        function say(speech, lang) {
            if (Storage.local('voice', '') == '') return;
            rec.stop();
            var speeches = speech.split('\\|');
            speeches.forEach(function (s) {
                tts.speak(s, lang);
            });
        }

        function notify(msg) {
            var messages = _.isString(msg) ? [msg] : msg.text ? [msg.text] : msg['speeches'];
            if (messages) {
                var name = Storage.local('name', i18n('settings.assistant.name.default'));
                messages.forEach(function (msg) {
                    chrome.notifications.create({
                        type: "basic", iconUrl: "./img/icon128.png",
                        title: name,
                        message: msg
                    });
                });
            }
        }

        function init(callback) {

            if (startWebSockets()) {
                if (_.isFunction(callback)) {
                    callback();
                }
            }

        }
    }
);

chrome.browserAction.onClicked.addListener(function () {
    chrome.runtime.openOptionsPage();
});