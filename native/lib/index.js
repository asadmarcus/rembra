const bindings = require('bindings');

let nativeAudio = null;

try {
    nativeAudio = bindings('audio_capture');
} catch (error) {
    console.log('Native audio capture module not available:', error.message);
}

module.exports = {
    startSystemCapture: (options) => {
        return new Promise((resolve, reject) => {
            if (!nativeAudio) {
                reject(new Error('Native audio module not available'));
                return;
            }

            nativeAudio.startSystemCapture(options, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    },

    stopCapture: () => {
        if (!nativeAudio) {
            return { success: false, error: 'Native audio module not available' };
        }
        return nativeAudio.stopCapture();
    },

    isAvailable: () => {
        return nativeAudio !== null;
    }
};