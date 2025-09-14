#include "audio_capture.h"
#include <iostream>
#include <vector>

SystemAudioCapture::SystemAudioCapture() : isCapturing(false) {
#ifdef __APPLE__
    audioUnit = nullptr;
    outputDevice = kAudioObjectUnknown;
#endif

#ifdef _WIN32
    deviceEnumerator = nullptr;
    device = nullptr;
    audioClient = nullptr;
    captureClient = nullptr;
    captureThread = nullptr;
    stopEvent = nullptr;
#endif
}

SystemAudioCapture::~SystemAudioCapture() {
    StopCapture();
    CleanupAudioCapture();
}

bool SystemAudioCapture::Initialize() {
    return SetupAudioCapture();
}

bool SystemAudioCapture::StartCapture() {
    if (isCapturing) {
        return true;
    }

#ifdef __APPLE__
    if (audioUnit) {
        OSStatus status = AudioUnitInitialize(audioUnit);
        if (status == noErr) {
            status = AudioOutputUnitStart(audioUnit);
            if (status == noErr) {
                isCapturing = true;
                return true;
            }
        }
    }
#endif

#ifdef _WIN32
    if (audioClient && captureClient) {
        HRESULT hr = audioClient->Start();
        if (SUCCEEDED(hr)) {
            stopEvent = CreateEvent(nullptr, FALSE, FALSE, nullptr);
            if (stopEvent) {
                captureThread = CreateThread(nullptr, 0, CaptureThreadProc, this, 0, nullptr);
                if (captureThread) {
                    isCapturing = true;
                    return true;
                }
            }
        }
    }
#endif

    return false;
}

void SystemAudioCapture::StopCapture() {
    if (!isCapturing) {
        return;
    }

#ifdef __APPLE__
    if (audioUnit) {
        AudioOutputUnitStop(audioUnit);
        AudioUnitUninitialize(audioUnit);
    }
#endif

#ifdef _WIN32
    if (stopEvent) {
        SetEvent(stopEvent);
    }
    if (captureThread) {
        WaitForSingleObject(captureThread, INFINITE);
        CloseHandle(captureThread);
        captureThread = nullptr;
    }
    if (stopEvent) {
        CloseHandle(stopEvent);
        stopEvent = nullptr;
    }
    if (audioClient) {
        audioClient->Stop();
    }
#endif

    isCapturing = false;
}

void SystemAudioCapture::SetAudioCallback(std::function<void(const float*, size_t)> callback) {
    audioCallback = callback;
}

bool SystemAudioCapture::SetupAudioCapture() {
#ifdef __APPLE__
    return SetupAudioUnit();
#endif

#ifdef _WIN32
    return SetupWASAPI();
#endif

    return false;
}

void SystemAudioCapture::CleanupAudioCapture() {
#ifdef __APPLE__
    CleanupAudioUnit();
#endif

#ifdef _WIN32
    CleanupWASAPI();
#endif
}

#ifdef __APPLE__
bool SystemAudioCapture::SetupAudioUnit() {
    // Set up Core Audio Tap for automatic system audio capture
    AudioComponentDescription desc = {};
    desc.componentType = kAudioUnitType_Output;
    desc.componentSubType = kAudioUnitSubType_HALOutput;
    desc.componentManufacturer = kAudioUnitManufacturer_Apple;
    desc.componentFlags = 0;
    desc.componentFlagsMask = 0;

    AudioComponent component = AudioComponentFindNext(nullptr, &desc);
    if (!component) {
        return false;
    }

    OSStatus status = AudioComponentInstanceNew(component, &audioUnit);
    if (status != noErr) {
        return false;
    }

    // Get the default output device (what the system is playing to)
    AudioObjectPropertyAddress propertyAddress = {
        kAudioHardwarePropertyDefaultOutputDevice,
        kAudioObjectPropertyScopeGlobal,
        kAudioObjectPropertyElementMain
    };

    UInt32 deviceID;
    UInt32 size = sizeof(deviceID);
    status = AudioObjectGetPropertyData(kAudioObjectSystemObject,
                                       &propertyAddress,
                                       0,
                                       nullptr,
                                       &size,
                                       &deviceID);

    if (status != noErr) {
        CleanupAudioUnit();
        return false;
    }

    outputDevice = deviceID;

    // Set the AudioUnit to use the default output device for INPUT (loopback)
    status = AudioUnitSetProperty(audioUnit,
                                 kAudioOutputUnitProperty_CurrentDevice,
                                 kAudioUnitScope_Global,
                                 0,
                                 &outputDevice,
                                 sizeof(outputDevice));

    if (status != noErr) {
        CleanupAudioUnit();
        return false;
    }

    // Enable input on the AudioUnit (this captures what's being played)
    UInt32 enableIO = 1;
    status = AudioUnitSetProperty(audioUnit,
                                 kAudioOutputUnitProperty_EnableIO,
                                 kAudioUnitScope_Input,
                                 1,
                                 &enableIO,
                                 sizeof(enableIO));

    if (status != noErr) {
        CleanupAudioUnit();
        return false;
    }

    // Disable output (we only want to capture, not play)
    enableIO = 0;
    status = AudioUnitSetProperty(audioUnit,
                                 kAudioOutputUnitProperty_EnableIO,
                                 kAudioUnitScope_Output,
                                 0,
                                 &enableIO,
                                 sizeof(enableIO));

    if (status != noErr) {
        CleanupAudioUnit();
        return false;
    }

    // Set up the input callback to capture system audio
    AURenderCallbackStruct callbackStruct;
    callbackStruct.inputProc = AudioInputCallback;
    callbackStruct.inputProcRefCon = this;

    status = AudioUnitSetProperty(audioUnit,
                                 kAudioOutputUnitProperty_SetInputCallback,
                                 kAudioUnitScope_Global,
                                 0,
                                 &callbackStruct,
                                 sizeof(callbackStruct));

    return status == noErr;
}

void SystemAudioCapture::CleanupAudioUnit() {
    if (audioUnit) {
        AudioComponentInstanceDispose(audioUnit);
        audioUnit = nullptr;
    }
}

OSStatus SystemAudioCapture::AudioInputCallback(void* inRefCon,
                                               AudioUnitRenderActionFlags* ioActionFlags,
                                               const AudioTimeStamp* inTimeStamp,
                                               UInt32 inBusNumber,
                                               UInt32 inNumberFrames,
                                               AudioBufferList* ioData) {
    SystemAudioCapture* capture = static_cast<SystemAudioCapture*>(inRefCon);
    
    // Create buffer list for rendering system audio
    AudioBufferList* bufferList = (AudioBufferList*)malloc(sizeof(AudioBufferList) + sizeof(AudioBuffer));
    bufferList->mNumberBuffers = 1;
    bufferList->mBuffers[0].mNumberChannels = 2; // Stereo
    bufferList->mBuffers[0].mDataByteSize = inNumberFrames * sizeof(float) * 2;
    bufferList->mBuffers[0].mData = malloc(bufferList->mBuffers[0].mDataByteSize);
    
    // Render the system audio (capture what's being played)
    OSStatus status = AudioUnitRender(capture->audioUnit,
                                     ioActionFlags,
                                     inTimeStamp,
                                     inBusNumber,
                                     inNumberFrames,
                                     bufferList);
    
    if (status == noErr && capture->audioCallback) {
        // Convert to float and send to callback
        float* audioData = static_cast<float*>(bufferList->mBuffers[0].mData);
        capture->audioCallback(audioData, inNumberFrames * 2); // * 2 for stereo
    }
    
    // Clean up
    free(bufferList->mBuffers[0].mData);
    free(bufferList);
    
    return status;
}
#endif

#ifdef _WIN32
bool SystemAudioCapture::SetupWASAPI() {
    HRESULT hr = CoInitialize(nullptr);
    if (FAILED(hr)) {
        return false;
    }

    hr = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                         __uuidof(IMMDeviceEnumerator), (void**)&deviceEnumerator);
    if (FAILED(hr)) {
        return false;
    }

    hr = deviceEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device);
    if (FAILED(hr)) {
        return false;
    }

    hr = device->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, (void**)&audioClient);
    if (FAILED(hr)) {
        return false;
    }

    WAVEFORMATEX* waveFormat = nullptr;
    hr = audioClient->GetMixFormat(&waveFormat);
    if (FAILED(hr)) {
        return false;
    }

    hr = audioClient->Initialize(AUDCLNT_SHAREMODE_SHARED,
                                AUDCLNT_STREAMFLAGS_LOOPBACK,
                                10000000, // 1 second buffer
                                0,
                                waveFormat,
                                nullptr);
    
    CoTaskMemFree(waveFormat);
    
    if (FAILED(hr)) {
        return false;
    }

    hr = audioClient->GetService(__uuidof(IAudioCaptureClient), (void**)&captureClient);
    return SUCCEEDED(hr);
}

void SystemAudioCapture::CleanupWASAPI() {
    if (captureClient) {
        captureClient->Release();
        captureClient = nullptr;
    }
    if (audioClient) {
        audioClient->Release();
        audioClient = nullptr;
    }
    if (device) {
        device->Release();
        device = nullptr;
    }
    if (deviceEnumerator) {
        deviceEnumerator->Release();
        deviceEnumerator = nullptr;
    }
    CoUninitialize();
}

DWORD WINAPI SystemAudioCapture::CaptureThreadProc(LPVOID lpParameter) {
    SystemAudioCapture* capture = static_cast<SystemAudioCapture*>(lpParameter);
    
    while (WaitForSingleObject(capture->stopEvent, 0) == WAIT_TIMEOUT) {
        UINT32 packetLength = 0;
        HRESULT hr = capture->captureClient->GetNextPacketSize(&packetLength);
        
        if (SUCCEEDED(hr) && packetLength > 0) {
            BYTE* data = nullptr;
            UINT32 numFramesAvailable = 0;
            DWORD flags = 0;
            
            hr = capture->captureClient->GetBuffer(&data, &numFramesAvailable, &flags, nullptr, nullptr);
            
            if (SUCCEEDED(hr)) {
                if (capture->audioCallback && !(flags & AUDCLNT_BUFFERFLAGS_SILENT)) {
                    // Convert to float and call callback
                    std::vector<float> audioData(numFramesAvailable);
                    // Basic conversion - would need proper format handling
                    for (UINT32 i = 0; i < numFramesAvailable; i++) {
                        audioData[i] = static_cast<float>(reinterpret_cast<short*>(data)[i]) / 32768.0f;
                    }
                    capture->audioCallback(audioData.data(), numFramesAvailable);
                }
                
                capture->captureClient->ReleaseBuffer(numFramesAvailable);
            }
        }
        
        Sleep(10); // Small delay to prevent excessive CPU usage
    }
    
    return 0;
}
#endif