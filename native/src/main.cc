#include <nan.h>
#include "audio_capture.h"
#include <memory>
#include <thread>
#include <chrono>
#include <string>

class AudioCaptureWorker : public Nan::AsyncWorker {
public:
    AudioCaptureWorker(Nan::Callback* callback, const std::string& platform)
        : Nan::AsyncWorker(callback), platform_(platform), success_(false) {}

    void Execute() override {
        capture_ = std::make_unique<SystemAudioCapture>();
        
        if (capture_->Initialize()) {
            if (capture_->StartCapture()) {
                success_ = true;
                // Capture for a short duration to get audio data
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
                capture_->StopCapture();
            } else {
                SetErrorMessage("Failed to start audio capture");
            }
        } else {
            SetErrorMessage("Failed to initialize audio capture");
        }
    }

    void HandleOKCallback() override {
        Nan::HandleScope scope;
        
        v8::Local<v8::Object> result = Nan::New<v8::Object>();
        Nan::Set(result, Nan::New("success").ToLocalChecked(), Nan::New(success_));
        
        if (success_) {
            Nan::Set(result, Nan::New("audioData").ToLocalChecked(), Nan::New("audio_data_placeholder").ToLocalChecked());
        }
        
        v8::Local<v8::Value> argv[] = { Nan::Null(), result };
        callback->Call(2, argv, async_resource);
    }

    void HandleErrorCallback() override {
        Nan::HandleScope scope;
        
        v8::Local<v8::Object> result = Nan::New<v8::Object>();
        Nan::Set(result, Nan::New("success").ToLocalChecked(), Nan::New(false));
        Nan::Set(result, Nan::New("error").ToLocalChecked(), Nan::New(ErrorMessage()).ToLocalChecked());
        
        v8::Local<v8::Value> argv[] = { Nan::Null(), result };
        callback->Call(2, argv, async_resource);
    }

private:
    std::string platform_;
    bool success_;
    std::unique_ptr<SystemAudioCapture> capture_;
};

NAN_METHOD(StartSystemCapture) {
    if (info.Length() < 2 || !info[1]->IsFunction()) {
        Nan::ThrowTypeError("Expected callback function");
        return;
    }

    std::string platform = "unknown";
    if (info.Length() > 0 && info[0]->IsObject()) {
        v8::Local<v8::Object> options = info[0].As<v8::Object>();
        v8::Local<v8::Value> platformValue = Nan::Get(options, Nan::New("platform").ToLocalChecked()).ToLocalChecked();
        if (platformValue->IsString()) {
            Nan::Utf8String platformStr(platformValue);
            platform = std::string(*platformStr);
        }
    }

    Nan::Callback* callback = new Nan::Callback(info[1].As<v8::Function>());
    Nan::AsyncQueueWorker(new AudioCaptureWorker(callback, platform));
}

NAN_METHOD(StopCapture) {
    // Implementation for stopping capture
    v8::Local<v8::Object> result = Nan::New<v8::Object>();
    Nan::Set(result, Nan::New("success").ToLocalChecked(), Nan::New(true));
    info.GetReturnValue().Set(result);
}

NAN_MODULE_INIT(Init) {
    Nan::Set(target, Nan::New("startSystemCapture").ToLocalChecked(),
        Nan::GetFunction(Nan::New<v8::FunctionTemplate>(StartSystemCapture)).ToLocalChecked());
    Nan::Set(target, Nan::New("stopCapture").ToLocalChecked(),
        Nan::GetFunction(Nan::New<v8::FunctionTemplate>(StopCapture)).ToLocalChecked());
}

NODE_MODULE(audio_capture, Init)