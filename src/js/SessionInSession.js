Session = function (sessions, port, that, speaker, closer) {
    this.sessions = sessions;
    this.port = port;
    this.that = that;
    this.speaker = speaker;
    this.closer = closer;
    this.up_alive = true;
    this.down_alive = true;
};

Session.prototype.getPort = function () {
    return this.port;
};

Session.prototype.writeDown = function (data, offset, count) {
    this.speaker(this, data, offset, count);
};

Session.prototype.closeDown = function () {
    this.down_alive = false;
    this.closer(this);
    this.checkAlive();
};

Session.prototype.checkAlive = function () {
    if (!this.up_alive && !this.down_alive) {
        if (this.that) {
            this.sessions.deleteThatSession.call(this.sessions, this.port);
        } else {
            this.sessions.deleteThisSession.call(this.sessions, this.port);
        }
        this.sessions = null;
        this.port = null;
        this.that = null;
        this.speaker = null;
        this.closer = null;
        this.up_alive = null;
        this.down_alive = null;
    }
};

Session.prototype.receiveDown = function () {
    var code = this.that ? 'E' : 'V';
    this.sessions.send.call(this.sessions, code, this.port, null, 0, 0);
    this.up_alive = false;
    this.checkAlive();
};

Session.prototype.receive = function (buffer) {
    var code = this.that ? 'D' : 'U';
    var len = buffer.length;
    this.sessions.send.call(this.sessions, code, this.port, buffer, 0, len);
};


SessionInSession = function (listener, speaker) {
    this.listener = listener;
    this.speaker = speaker;
    this.thislist = {};
    this.thatlist = {};
    this.cache = new Uint8Array();
};

SessionInSession.prototype.getThisSession = function (port) {
    var session = this.thislist[port];
    return session;
};

SessionInSession.prototype.getThatSession = function (port) {
    var session = this.thatlist[port];
    return session;
};

SessionInSession.prototype.deleteThisSession = function (port) {
    var session = this.thislist[port];
    this.thislist[port] = null;
    delete this.thislist[port];
};

SessionInSession.prototype.deleteThatSession = function (port) {
    this.send('E', port, null, 0, 0);
    this.thatlist[port] = null;
    delete this.thatlist[port];
};

var portCount = 0;

SessionInSession.prototype.create = function (speaker, closer) {
    var port = ++portCount;
    while (port === 0 || (port in this.thislist)) {
        port++;
    }
    // printBTLog("port create: " + port);
    var session = new Session(this, port, false, speaker, closer);
    this.thislist[port] = session;
    this.send('O', port, null, 0, 0);
    return port;
};

SessionInSession.prototype.setInt = function (buffer, offset, value) {
    buffer[offset + 3] = (value) % 256;
    value /= 256;
    buffer[offset + 2] = (value) % 256;
    value /= 256;
    buffer[offset + 1] = (value) % 256;
    value /= 256;
    buffer[offset + 0] = (value) % 256;
};

SessionInSession.prototype.getInt = function (buffer, offset) {
    var value = 0;
    for (var i = 0; i < 4; i++) {
        value *= 256;
        value += buffer[offset + i];
    }
    return value;
};

SessionInSession.prototype.send = function (code, port, data, offset, length) {
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

SessionInSession.prototype.receive = function (buffer) {
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

SessionInSession.prototype.parse = function (buffer) {
    var code = buffer[0];
    var port = this.getInt(buffer, 1);
    var length = this.getInt(buffer, 5);

    // printBTLog("code recv: " + code);
    switch (code) {
        case -1:
            return;
        case 'O'.charCodeAt(0):
            {
                var session = new Session(this, port, true);
                this.thatlist[port] = session;
                if (this.listener !== undefined) {
                    this.listener.call(this.listener, port);
                }
            }
            break;
        case 'U'.charCodeAt(0):
            {
                var session1 = this.getThatSession(port);
                if (session1 !== undefined) {
                    session1.writeDown.call(session1, buffer, 9, length);
                }
            }
            break;
        case 'V'.charCodeAt(0):
            {
                var session2 = this.getThatSession(port);
                if (session2 !== undefined) {
                    this.deleteThatSession(port);
                }
            }
            break;
        case 'D'.charCodeAt(0):
            {
                var session3 = this.getThisSession(port);
                if (session3 !== undefined) {
                    session3.writeDown.call(session3, buffer, 9, length);
                }
            }
            break;
        case 'E'.charCodeAt(0):
            {
                var session4 = this.getThisSession(port);
                if (session4 !== undefined) {
                    session4.closeDown.call(session4);
                    // this.deleteThisSession(port);
                }
            }
            break;
    }
};
