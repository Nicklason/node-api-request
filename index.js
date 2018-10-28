const request = require('requestretry').defaults({
    json: true,
    gzip: true,
    timeout: 5000,
    retryStrategy: retryStrategy,
    delayStrategy: delayStrategy
});

function retryStrategy (err, response, body) {
    const networkError = request.RetryStrategies.NetworkError(err, response, body);
    if (networkError !== null && this.attempts > 3) {
        return errorHandler.call(this, err, response, body);
    }

    if (response === undefined) {
        return true;
    }

    if (response.statusCode === 200) {
        return false;
    } else if (response.statusCode > 499 && response.statusCode < 600 && this.attempts > 1) {
        return errorHandler.call(this, err, response, body);
    } else if (response.statusCode === 429 && this.attempts > 1) {
        return errorHandler.call(this, err, response, body);
    } else if (response.statusCode !== 200 && this.attempts > 2) {
        return errorHandler.call(this, err, response, body);
    }

    return true;
}

function errorHandler (err, response, body) {
    if (!err) {
        if (response.statusCode > 499 && response.statusCode < 600) {
            err = new Error(response.request.host + ' is down');
        } else if (response.statusCode !== 200) {
            err = new Error('HTTP error', response.statusCode);
        } else if (this.options.json === true && (!body || typeof body !== 'object')) {
            err = new Error('Invalid response');
        }
    }

    if (err !== null) {
        if (response) {
            err.statusCode = response.statusCode;
        }
        if (body) {
            err.body = body;
        }

        err.attempts = this.attempts;

        // Reply with either callback or promise
        this.reply(err, response, body);
        // Replace callbacks with dummy functions
        if (this._callback) {
            this._callback = bye;
        } else if (this._reject) {
            this._reject = bye;
        }

        // Stop retrying
        return false;
    }
}

function delayStrategy (err, response, body) {
    if (response === undefined) {
        return 2 * 1000;
    } else if (response.statusCode === 429) {
        return response.headers.hasOwnProperty('retry-after') ? response.headers['retry-after'] : 60 * 1000;
    } else if (response.statusCode > 499) {
        return 10 * 1000;
    } else {
        return 2 * 1000;
    }
}

function bye () {}

module.exports = request;
