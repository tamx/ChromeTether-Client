chrome.bluetooth.getAdapterState(function (result) {
    if (result) {
        console.log(result);
    } else {
        console.log(chrome.runtime.lastError);
    }
});

//  Functions
function printBTLog(logmsg) {
    var btLog = $('#btLog');
    var btLogContent = $('#btLogContent');

    btLogContent.append(document.createTextNode(logmsg + '\n'));
    btLog.scrollTop(btLog[0].scrollHeight);
}

$(function () {
    var sessioninsession = null;
    var serverSocketId;
    var idlist = {};

    printBTLog("Chrome BT App 0.1");

    var btDeviceSelect = $('#btDeviceSelect');

    var socketID = 0;

    var deviceArray = {};
    var device_names = {};
    var deviceCount = 0;
    var deviceOffset = 0;

    //  Start up Code	
    var addDeviceName = function (device) {
        deviceArray[deviceCount++] = device;
        $('<option></option>').text(device.name).appendTo(btDeviceSelect);
    };
    var updateDeviceName = function (device) {
        flag = true;
        for (var i = 0; i < deviceCount; i++) {
            if (deviceArray[i].address == device.address) {
                flag = false;
                break;
            }
        }
        if (flag) {
            deviceArray[deviceCount++] = device;
            $('<option></option>').text(device.name).appendTo(btDeviceSelect);
        }
        printBTLog('  Have a device update - ' + device.name);
    };
    var removeDeviceName = function (device) {
        delete device_names[device.address];
    };
    // Add listeners to receive newly found devices and updates
    // to the previously known devices.
    chrome.bluetooth.onDeviceAdded.addListener(updateDeviceName);
    chrome.bluetooth.onDeviceChanged.addListener(updateDeviceName);
    chrome.bluetooth.onDeviceRemoved.addListener(removeDeviceName);

    // Get the list of paired devices.
    printBTLog("");
    chrome.bluetooth.getDevices(function (devices) {
        for (var i = 0; i < devices.length; i++) {
            printBTLog('Found: ' + devices[i].name);
            deviceArray[deviceCount++] = devices[i];
            $('<option></option>').text(devices[i].name).appendTo(btDeviceSelect);
            updateDeviceName(devices[i]);
        }
    });
    chrome.bluetooth.startDiscovery(function () {
        // Stop discovery after 3 seconds.
        printBTLog('Starting Bluetooth Device Scan.');
        setTimeout(function () {
            chrome.bluetooth.stopDiscovery(function () { });
            printBTLog('Finished Scanning for Bluetooth Devices.');
            $('#selectedBTDevice').empty().text(btDeviceSelect.val());
        }, 30000);
    });

    $('#btDeviceSelect')
        .change(function () {
            $('#selectedBTDevice').empty().text($('#btDeviceSelect').val());
        });

    function startBTconnect() {
        var btDeviceName = $('#btDeviceSelect').val();
        deviceOffset = $("#btDeviceSelect")[0].selectedIndex;
        if (deviceArray[deviceOffset] === null) {
            return;
        }
        var btDeviceAddress = deviceArray[deviceOffset].address;
        printBTLog('');
        printBTLog('Starting Connection to ' + btDeviceName);
        if (!btDeviceName) {
            printBTLog('No Bluetooth Device Selected.');
            return;
        } else if (!socketID) {
            chrome.bluetoothSocket.create(function (createInfo) {
                if (chrome.runtime.lastError) {
                    AddConnectedSocketId(socketID = 0);
                    printBTLog("Socket Create Failed: " + chrome.runtime.lastError.message);
                } else {
                    socketID = createInfo.socketId;
                    chrome.bluetoothSocket.connect(createInfo.socketId,
                        btDeviceAddress, "0000000c-0000-1000-8000-00805f9b34fb", onConnectedCallback);
                }
            });
            if (chrome.runtime.lastError) {
                AddConnectedSocketId(socketID = 0);
                printBTLog("Connection Operation failed: " + chrome.runtime.lastError.message);
            }
        } else {
            printBTLog('Already connected.');
        }
    };
    $('#btConnect').click(function () {
        startBTconnect();
    });

    var onConnectedCallback = function () {
        if (chrome.runtime.lastError) {
            AddConnectedSocketId(socketID = 0);
            printBTLog("Connection failed: " + chrome.runtime.lastError.message);
        } else {
            // Profile implementation here.
            printBTLog("Connected with socketID = " + socketID);
            AddConnectedSocketId(socketID);
            $('#socketId').text(socketID);
            $('#btStatus').text("Connected");
            // chrome.browserAction.setIcon({path:"tam-glass.png"});

            sessioninsession = new SessionInSession(null, BTspeaker);
            chrome.bluetoothSocket.onReceive.addListener(onBTReceive);
            chrome.bluetoothSocket.onReceiveError.addListener(onBTReceiveError);

            {
                /**
                 * ���N�G�X�g�p�\�P�b�g�쐬
                 */
                chrome.sockets.tcpServer.onAccept.addListener(onAccept);
                chrome.sockets.tcp.onReceive.addListener(onTcpReceive);
                chrome.sockets.tcp.onReceiveError.addListener(onTcpReceiveError);

                /**
                 * �T�[�o�N��
                 */
                chrome.sockets.tcpServer.create({}, TCPcreate);

                /*
                        var config = {
                            mode: "fixed_servers",
                            rules: {
                                singleProxy: {
                                    scheme: "http",
                                    host: "127.0.0.1",
                                    port: 3000,
                                },
                            }
                        };
                        chrome.proxy.settings.set({
                                value: config,
                                scope: 'regular'
                            });
                */
                navigator.onLine = true;
            };
        }
    };

    $('#btDisconnect')
        .click(function () {
            printBTLog('');
            stopProxy();
        });

    $('#btGetDevice')
        .click(function () {
            deviceOffset = $("#btDeviceSelect")[0].selectedIndex;
            var deviceInfo = deviceArray[deviceOffset];
            printBTLog("");
            printBTLog(deviceArray[deviceOffset].name + " Has Address " + deviceInfo.address);
            if (deviceInfo.deviceClass) {
                printBTLog(" Device Class:" + deviceInfo.deviceClass);
            }
            if (deviceInfo.vendorId) {
                printBTLog(" Vendor ID:" + deviceInfo.vendorId);
            }
            if (deviceInfo.productId) {
                printBTLog(" Product ID:" + deviceInfo.productId);
            }
            if (deviceInfo.deviceId) {
                printBTLog(" Device ID:" + deviceInfo.deviceId);
            }
            if (deviceInfo.paired) {
                printBTLog(" Paired:" + deviceInfo.paired);
            }
            if (deviceInfo.connected) {
                printBTLog(" Connected:" + deviceInfo.connected);
            }
            for (var i = 0; deviceInfo.uuids.length > i; ++i) {
                printBTLog(" uuid:" + deviceInfo.uuids[i]);
            }
            if (chrome.runtime.lastError) {
                printBTLog("getDevice Operation failed: " + chrome.runtime.lastError.message);
            }
        });

    function TCPcreate(createInfo) {
        // �T�[�o�p�̃\�P�b�g
        serverSocketId = createInfo.socketId;

        // 3000�ԃ|�[�g��listen
        chrome.sockets.tcpServer.listen(serverSocketId, '0.0.0.0', 3000, function (resultCode) {
            if (resultCode < 0) {
                printBTLog("Error listening:" + chrome.runtime.lastError.message);
            }
            for (var key in idlist) {
                var id = Number(key);
                // �\�P�b�g�j��
                chrome.sockets.tcp.disconnect(id);
                chrome.sockets.tcp.close(id);
                delete idlist[id];
            }
            idlist = {};
        });
    };

    function BTspeaker(data) {
        if (socketID) {
            chrome.bluetoothSocket.send(socketID, data.buffer, function (bytes_sent) {
                if (chrome.runtime.lastError) {
                    printBTLog("send Operation failed: " + chrome.runtime.lastError.message);
                } else {
                    // printBTLog('Sent ' + bytes_sent + ' bytes');
                }
            });
        } else {
            printBTLog('Not connected.');
        }
    };

    function onBTReceive(info) {
        var socketId = info.socketId;
        if (socketID == socketId) {
            // printBTLog('Received ' + info.data.byteLength + ' bytes');
            var buf = new Uint8Array(info.data);
            sessioninsession.receive.call(sessioninsession, buf);
            buf = null;
        }
    }

    function onBTReceiveError(errorInfo) {
        printBTLog("Receive Error:");
        printBTLog(errorInfo.errorMessage);
        stopProxy(true);
    }

    function stopProxy(restart) {
        /*
            chrome.proxy.settings.clear({
                    scope: 'regular'
                },
                function() {
                    console.log(chrome.proxy);
                });
        */
        chrome.sockets.tcpServer.onAccept.removeListener(onAccept);
        chrome.sockets.tcp.onReceive.removeListener(onTcpReceive);
        chrome.sockets.tcp.onReceiveError.removeListener(onTcpReceiveError);
        if (serverSocketId === null) {
            return;
        }
        chrome.sockets.tcpServer.disconnect(serverSocketId, function () {
            for (var key in idlist) {
                var session = Number(key);
                // �\�P�b�g�j��
                chrome.sockets.tcp.disconnect(session);
                chrome.sockets.tcp.close(session);
                delete idlist[key];
            }
            sessioninsession = null;
            chrome.sockets.tcpServer.close(serverSocketId, function () {
                serverSocketId = null;
                idlist = {};
                printBTLog('Disconnect successful');
                if (restart) {
                    startBTconnect();
                }
            });
        });
        if (socketID) {
            printBTLog('Disconnecting connection id ' + socketID + '...');
            sessioninsession = null;
            chrome.bluetoothSocket.onReceive.removeListener(onBTReceive);
            chrome.bluetoothSocket.onReceiveError.removeListener(onBTReceiveError);
            chrome.bluetoothSocket.disconnect(socketID);
            chrome.bluetoothSocket.close(socketID);
            socketID = 0;
            AddConnectedSocketId(0);
            $('#socketId').text("-");
            $('#btStatus').text("Disconnected");
        } else {
            printBTLog('Not connected.');
        }
        // chrome.browserAction.setIcon({path:"tam.png"});
        socketID = 0;
    }

    function getKey(session) {
        var id = 0;
        for (var key in idlist) {
            if (idlist[key] === session) {
                id = Number(key);
                return id;
            }
        }
        return 0;
    }

    function TCPspeaker(session, data, offset, length) {
        // printBTLog("data length: " + data.length);
        var id = getKey(session);
        // printBTLog("data recv: " + id);
        if (id !== 0) {
            // var data2 = new Uint8Array(data.buffer, offset, length);
            var data2 = new Uint8Array(length);
            for (var i = 0; i < length; i++) {
                data2[i] = data[offset + i];
            }
            chrome.sockets.tcp.send(id, data2.buffer, function (info) {
                if (info.resultCode < 0) {
                    var id = info.socketId;
                    printBTLog("Error sending:" + chrome.runtime.lastError.message);
                    closeSession(id);
                }
            });
        } else {
            // session.closeDown.call(session);
        }
    }

    function TCPcloser(session) {
        // printBTLog("Close Session: " + session);
        var id = getKey(session);
        // printBTLog("Close: " + id);
        // �\�P�b�g�j��
        if (id !== 0) {
            closeSession(id);
        }
    }

    var onAccept = function (info) {
        if (info.socketId === serverSocketId) {
            var id = info.clientSocketId;
            var port = sessioninsession.create.call(sessioninsession, TCPspeaker, TCPcloser);
            var session = sessioninsession.getThisSession.call(sessioninsession, port);
            idlist[id] = session;
            chrome.sockets.tcp.setPaused(id, false);
            // printBTLog("id: " + id);
            // printBTLog("id length: " + Object.keys(idlist).length);
        }
    };

    /**
     * ���N�G�X�g���M
     */
    var onTcpReceive = function (info) {
        var id = info.socketId;
        // printBTLog("id recv: " + id);

        var data = new Uint8Array(info.data);
        // var str = "";
        // for (var i=0;i < data.length;i++){
        //   str += ":" + data[i];
        // }
        // printBTLog(str);
        var session = idlist[id];
        if (session !== undefined && data.length > 0) {
            session.receive.call(session, data);
        } else {
            printBTLog("session not found.");
            // closeSession(id);
        }
        data = null;
    };

    /**
     * �f�[�^���M�G���[
     */
    function onTcpReceiveError(info) {
        var id = info.socketId;
        var session = idlist[id];
        if (session !== undefined) {
            // printBTLog("id close: " + id);
            session.receiveDown.call(session);
            closeSession(id);
        }
        // console.log("Error: ", info);
    };

    function closeSession(id) {
        // printBTLog("Close id: " + id);
        if (id === 0) {
            return;
        }
        var session = idlist[id];
        if (session !== undefined) {
            delete idlist[id];
            sessioninsession.deleteThisSession(id);
            chrome.sockets.tcp.disconnect(id);
            chrome.sockets.tcp.close(id);
        }
    }
});
