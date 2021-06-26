Session = function(sessions, port, speaker, closer) {
    this.sessions = sessions;
    this.port = port;
    this.speaker = speaker;
    this.closer = closer;
    this.up_alive = true;
    this.down_alive = true;
};

Session.prototype.getPort = function() {
    return this.port;
};

Session.prototype.writeDown = function(data, offset, count) {
    this.speaker(this, data, offset, count);
};

Session.prototype.closeDown = function() {
    this.down_alive = false;
    if (this.closer !== null) {
        this.closer(this);
    }
    this.checkAlive();
};

Session.prototype.checkAlive = function() {
    if (!this.up_alive && !this.down_alive) {
        if (this.sessions !== null) {
            this.sessions.deleteSession.call(this.sessions, this.port);
        }
        this.sessions = null;
        this.port = null;
        this.speaker = null;
        this.closer = null;
        this.up_alive = null;
        this.down_alive = null;
    }
};

Session.prototype.closeUp = function() {
    this.sessions.send.call(this.sessions, 'F',
        this.port, null, 0, 0);
    this.up_alive = false;
    this.checkAlive();
};

Session.prototype.receive = function(buffer) {
    var len = buffer.length;
    this.sessions.send.call(this.sessions, 'D',
        this.port, buffer, 0, len);
};


SessionInSession = function(listener, speaker) {
    this.listener = listener;
    this.speaker = speaker;
    this.portlist = {};
    this.cache = new Uint8Array();
};

SessionInSession.prototype.getSession = function(port) {
    var session = this.portlist[port];
    return session;
};

SessionInSession.prototype.deleteSession = function(port) {
    var session = this.portlist[port];
    this.portlist[port] = null;
    delete this.portlist[port];
    if (session !== undefined) {
        session.closeUp();
        session.closeDown();
    }
};

var portCount = 0;

SessionInSession.prototype.create = function(speaker, closer) {
    var port = ++portCount;
    while (port === 0 || (port in this.portlist)) {
        port++;
    }
    // printBTLog("port create: " + port);
    var session = new Session(this, port, speaker, closer);
    this.portlist[port] = session;
    this.send('S', port, null, 0, 0);
    return port;
};

SessionInSession.prototype.setInt = function(buffer,
    offset, value) {
    buffer[offset + 3] = (value) % 256;
    value /= 256;
    buffer[offset + 2] = (value) % 256;
    value /= 256;
    buffer[offset + 1] = (value) % 256;
    value /= 256;
    buffer[offset + 0] = (value) % 256;
};

SessionInSession.prototype.getInt = function(buffer,
    offset) {
    var value = 0;
    for (var i = 0; i < 4; i++) {
        value *= 256;
        value += buffer[offset + i];
    }
    return value;
};

SessionInSession.prototype.send = function(code, port,
    data, offset, length) {
    var buffer = new Uint8Array(1 + 4 + 4 + length);
    buffer[0] = code.charCodeAt(0);
    this.setInt(buffer, 1, port);
    this.setInt(buffer, 5, length);
    for (var i = 0; i < length; i++) {
        buffer[i + 9] = data[offset + i];
    }
    this.speaker.call(this.speaker, buffer);
    buffer = null;
    // printBTLog("code send: " + code);
};

SessionInSession.prototype.receive = function(buffer) {
    var length = this.cache.length;
    var cache_tmp = new Uint8Array(length + buffer.length);
    for (var i = 0; i < length; i++) {
        cache_tmp[i] = this.cache[i];
    }
    for (var j = 0; j < buffer.length; j++) {
        cache_tmp[length + j] = buffer[j];
    }
    this.cache = null;
    this.cache = cache_tmp;
    cache_tmp = null;
    // var code = cache[0];
    // var port = this.getInt(cache, 1);
    while (this.cache.length >= 9) {
        length = this.getInt(this.cache, 5);
        if (this.cache.length >= length + 9) {
            // console.log("Length: " + length);
            this.parse(this.cache);
            cache_tmp = new Uint8Array(this.cache.length - length - 9);
            for (var k = 0; k < this.cache.length - length - 9; k++) {
                cache_tmp[k] = this.cache[length + 9 + k];
            }
            this.cache = null;
            this.cache = cache_tmp;
            cache_tmp = null;
        } else {
            break;
        }
    }
};

SessionInSession.prototype.parse = function(buffer) {
    var code = buffer[0];
    var port = this.getInt(buffer, 1);
    var length = this.getInt(buffer, 5);

    // printBTLog("code recv: " + code);
    switch (code) {
        case -1:
            return;
        case 'S'.charCodeAt(0):
            {
                var session = new Session(this, port, true);
                this.portlist[port] = session;
                if (this.listener !== undefined) {
                    this.listener.call(this.listener, port);
                }
                this.send('A', port, null, 0, 0);
            }
            break;
        case 'A'.charCodeAt(0):
            {}
            break;
        case 'D'.charCodeAt(0):
            {
                var session3 = this.getSession(port);
                if (session3 !== undefined) {
                    session3.writeDown.call(session3, buffer, 9, length);
                }
            }
            break;
        case 'F'.charCodeAt(0):
            {
                var session4 = this.getSession(port);
                if (session4 !== undefined) {
                    session4.closeDown.call(session4);
                    // this.deleteThisSession(port);
                }
            }
            break;
        case 'F'.charCodeAt(0):
            {
                var session4 = this.getSession(port);
                if (session4 !== undefined) {
                    session4.closeUp.call(session4);
                    session4.closeDown.call(session4);
                    // this.deleteThisSession(port);
                }
            }
            break;
    }
};