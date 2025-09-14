#ifndef AUDIO_CAPTURE_H
#define AUDIO_CAPTURE_H

#ifdef __APPLE__
#include <CoreAudio/CoreAudio.h>
#include <AudioUnit/AudioUnit.h>
#include <AudioToolbox/AudioToolbox.h>
#endif

#ifdef _WIN32
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audiopolicy.h>
#include <endpointvolume.h>
#endif

#include <vector>
#include <functional>

class SystemAudioCapture {
public:
    SystemAudioCapture();
    ~SystemAudioCapture();
    
    bool Initialize();
    bool StartCapture();
    void StopCapture();
    bool IsCapturing() const { return isCapturing; }
    
    // Set callback for audio data
    void SetAudioCallback(std::function<void(const float*, size_t)> callback);
    
private:
#ifdef __APPLE__
    AudioUnit audioUnit;
    AudioDeviceID outputDevice;
    
    bool SetupAudioUnit();
    void CleanupAudioUnit();
    
    static OSStatus AudioInputCallback(void* inRefCon,
                                     AudioUnitRenderActionFlags* ioActionFlags,
                                     const AudioTimeStamp* inTimeStamp,
                                     UInt32 inBusNumber,
                                     UInt32 inNumberFrames,
                                     AudioBufferList* ioData);
#endif

#ifdef _WIN32
    IMMDeviceEnumerator* deviceEnumerator;
    IMMDevice* device;
    IAudioClient* audioClient;
    IAudioCaptureClient* captureClient;
    HANDLE captureThread;
    HANDLE stopEvent;
    
    static DWORD WINAPI CaptureThreadProc(LPVOID lpParameter);
    bool SetupWASAPI();
    void CleanupWASAPI();
#endif
    
    bool isCapturing;
    std::function<void(const float*, size_t)> audioCallback;
    
    bool SetupAudioCapture();
    void CleanupAudioCapture();
};

#endif // AUDIO_CAPTURE_H