require(
    ['underscore', 'Recognizer', 'TTS', 'util/Storage', 'util/i18n'],
    function(_, Recognizer, TTS, Storage, i18n) {
        var options, listening;
        var beep = new Audio('beep.mp3');
        var wsTimer=0;
        var wsSocket;
        var startedWebSockets=0;


        var rec = new Recognizer(
            {
                result: recognized,
                partial: partial,
                error: onRecognizerError
            }
        );

        var tts = new TTS({ complete: listen });

        chrome.runtime.onMessage.addListener(function(request) {
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
         payload.data.TYPE='events';
         payload.data.EVENTS='SAY,SAYTO,SAYREPLY';
         console.log('Subscribing to '+payload.data.EVENTS);
         wsSocket.send(JSON.stringify(payload));
        }

        function startWebSockets() {
            var loc = window.location, new_uri;
            var serverUrl='';
            if (loc.protocol === "https:") {
                    serverUrl = "wss:";
            } else {
                    serverUrl = "ws:";
            }
            serverUrl += "//" + Storage.local('address', i18n('settings.address.default')) + ':8002/majordomo';
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
            wsSocket.onopen = function(msg) {
             ///connected
              startedWebSockets=1;
              clearTimeout(wsTimer);
              //$.publish('wsConnected');
              console.log('WS connected ('+serverUrl+')');
              wsConnected();
            };
            wsSocket.onmessage = function(msg) {
              console.log('WS data ('+serverUrl+')');
              var response;
              response = JSON.parse(msg.data);
              //$.publish('wsData', response);
              return;
            };
            wsSocket.onclose = function(msg) {
              //disconnected
              startedWebSockets=0;
              wsTimer=setTimeout('startWebSockets();', 5*1000);
              //$.publish('wsDisconnected', []);
              console.log('WS disconnected ('+serverUrl+')');
              return;
            };
            return true;
        }


        function listen() {
            rec.start();
        }

        function onRecognizerError(error) {
            if (error === 'no-speech') {
                listen();
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
            console.log('Recognized: '+result);
            var input = getCommand(result);
            if (input) {
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
            var name = Storage.local('name', i18n('settings.assistant.name.default'));
            text = text.toLowerCase();
            var pos = text.indexOf(name.toLowerCase());
            if (pos === -1 || text.length === name.length) return '';
            return cmd.substring(pos + name.length + 1);
        }

        function process(input) {
            listening = false;
            if (startedWebSockets) {
                //eventBus.send('asr.result', input);
                console.log('Sending to WS: '+input);
            } else {
                //init(_.partial(process, input));
            }
            var serverUrl = "http://" + Storage.local('address', i18n('settings.address.default')) + '/command.php?qry='+encodeURIComponent(input);

                 $.ajax({
                   url: serverUrl
                  }).done(function(data) { 
                   console.log('Returned: '+data);
                  });


        }

        function say(speech, lang) {
            rec.stop();
            var speeches = speech.split('\\|');
            speeches.forEach(function(s) {
                tts.speak(s, lang);
            });
        }

        function notify(msg) {
            var messages = _.isString(msg) ? [msg] : msg.text ? [msg.text] : msg['speeches'];
            if (messages) {
                var name = Storage.local('name', i18n('settings.assistant.name.default'));
                messages.forEach(function(msg) {
                    chrome.notifications.create({
                        type: "basic", iconUrl: "./img/icon128.png",
                        title: name,
                        message: msg
                    });
                });
            }
        }

        function init(callback) {
        /*
            if (startWebSockets()) {
                if (_.isFunction(callback)) {
                    callback();
                }
            }
        */

        }
    }
);

chrome.browserAction.onClicked.addListener(function() {
    chrome.runtime.openOptionsPage();
});