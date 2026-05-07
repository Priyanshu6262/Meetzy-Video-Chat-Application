import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneOff, Phone, Video, VideoOff, Mic, MicOff } from 'lucide-react';
import { useCall } from '../../context/CallContext';

const VideoCallPopup = () => {
  const {
    callStatus,
    callerInfo,
    receiverInfo,
    localStream,
    remoteStream,
    isCameraOn,
    isMicOn,
    acceptCall,
    rejectCall,
    endCall,
    toggleCamera,
    toggleMic
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus]);

  if (callStatus === 'idle') return null;

  const isIncoming = callStatus === 'incoming';
  const isCalling = callStatus === 'calling';
  const isConnected = callStatus === 'connected';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        
        {/* Backdrop for connected state (full screen-ish) */}
        {isConnected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/90 backdrop-blur-md pointer-events-auto"
          />
        )}

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={`
            relative flex flex-col overflow-hidden pointer-events-auto
            bg-white/10 dark:bg-slate-900/50 backdrop-blur-2xl border border-white/20 dark:border-slate-800/50
            shadow-2xl shadow-indigo-500/10 rounded-3xl
            ${isConnected ? 'w-full max-w-4xl aspect-video max-h-[80vh]' : 'w-full max-w-sm p-6'}
          `}
        >
          {/* Ringing / Incoming State */}
          {(isIncoming || isCalling) && (
            <div className="flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                {/* Ping animation behind avatar */}
                <div className="absolute inset-0 bg-indigo-500 rounded-full animate-ping opacity-20" />
                <img
                  src={(isIncoming ? callerInfo?.callerPhoto : receiverInfo?.photo) || ''}
                  alt="avatar"
                  className="w-24 h-24 rounded-full object-cover border-4 border-white/10 relative z-10"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                {!(isIncoming ? callerInfo?.callerPhoto : receiverInfo?.photo) && (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-bold text-white relative z-10 border-4 border-white/10">
                    {((isIncoming ? callerInfo?.callerName : receiverInfo?.name) || 'U')[0].toUpperCase()}
                  </div>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
                {isIncoming ? callerInfo?.callerName : receiverInfo?.name}
              </h3>
              <p className="text-sm font-medium text-indigo-500 dark:text-indigo-400 mb-8 animate-pulse">
                {isIncoming ? 'Incoming Video Call...' : 'Ringing...'}
              </p>

              <div className="flex items-center gap-6">
                {isIncoming ? (
                  <>
                    <button
                      onClick={rejectCall}
                      className="w-14 h-14 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-105 active:scale-95"
                    >
                      <PhoneOff className="w-6 h-6" />
                    </button>
                    <button
                      onClick={acceptCall}
                      className="w-14 h-14 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-95"
                    >
                      <Video className="w-6 h-6" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={endCall}
                    className="w-14 h-14 bg-rose-500 hover:bg-rose-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-500/30 transition-transform hover:scale-105 active:scale-95"
                  >
                    <PhoneOff className="w-6 h-6" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Connected State */}
          {isConnected && (
            <div className="absolute inset-0 bg-slate-950 flex">
              {/* Remote Video (Main) */}
              <div className="flex-1 relative">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!remoteStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <p className="text-white animate-pulse">Connecting...</p>
                  </div>
                )}
              </div>

              {/* Local Video (PIP) */}
              <div className="absolute top-4 right-4 w-32 sm:w-48 aspect-video bg-slate-800 rounded-xl overflow-hidden shadow-2xl border border-white/10 z-10">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {!isCameraOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800/90 backdrop-blur-sm">
                    <VideoOff className="w-6 h-6 text-slate-400" />
                  </div>
                )}
              </div>

              {/* Controls Bar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10 shadow-2xl z-20">
                <button
                  onClick={toggleMic}
                  className={`p-4 rounded-full transition-colors ${isMicOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}
                >
                  {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </button>
                <button
                  onClick={endCall}
                  className="p-4 bg-rose-500 hover:bg-rose-600 rounded-full text-white shadow-lg shadow-rose-500/20 transition-transform hover:scale-105 active:scale-95"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <button
                  onClick={toggleCamera}
                  className={`p-4 rounded-full transition-colors ${isCameraOn ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}`}
                >
                  {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VideoCallPopup;
