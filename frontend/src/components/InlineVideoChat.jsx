import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Check, MonitorUp, MonitorOff } from 'lucide-react';
import { motion } from 'framer-motion';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const InlineVideoChat = ({ roomId, onClose }) => {
  const { currentUser } = useAuth();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remoteUserConnected, setRemoteUserConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Creating Meeting...");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000');
    socketRef.current = socket;
    
    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        
        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setConnectionStatus("Waiting for User...");
        socket.emit('join-room', roomId, currentUser.uid);

        socket.on('user-connected', async (userId, socketId) => {
          if (!isMounted) return;
          console.log('User connected:', userId);
          setRemoteUserConnected(true);
          setConnectionStatus("User Joined");
          await callUser(socketId);
        });

        socket.on('offer', async (payload) => {
          if (!isMounted) return;
          console.log('Received offer');
          setRemoteUserConnected(true);
          setConnectionStatus("User Joined");
          await handleReceiveOffer(payload);
        });

        socket.on('answer', async (payload) => {
          if (!isMounted) return;
          console.log('Received answer');
          await handleReceiveAnswer(payload);
        });

        socket.on('ice-candidate', async (incoming) => {
          if (!isMounted) return;
          console.log('Received ICE candidate');
          await handleNewICECandidate(incoming);
        });

        socket.on('user-disconnected', () => {
          if (!isMounted) return;
          console.log('User disconnected');
          setRemoteUserConnected(false);
          setConnectionStatus("Waiting for User...");
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
          }
          if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
          }
        });

      } catch (err) {
        console.error("Error accessing media devices.", err);
        setConnectionStatus("Camera/Microphone access denied");
      }
    };

    initMedia();

    return () => {
      isMounted = false;
      socket.disconnect();
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
    };
  }, [roomId, currentUser]);

  const createPeerConnection = (targetSocketId) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = peerConnection;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', {
          target: targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      if (peerConnection.iceConnectionState === 'connected') {
        setConnectionStatus("Call Connected");
      } else if (peerConnection.iceConnectionState === 'disconnected') {
        setConnectionStatus("Waiting for User...");
        setRemoteUserConnected(false);
      }
    };

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    const streamToUse = isScreenSharing && screenStreamRef.current ? screenStreamRef.current : localStreamRef.current;
    
    if (streamToUse) {
      streamToUse.getTracks().forEach(track => {
        peerConnection.addTrack(track, streamToUse);
      });
    }

    return peerConnection;
  };

  const callUser = async (targetSocketId) => {
    const peerConnection = createPeerConnection(targetSocketId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socketRef.current.emit('offer', {
      target: targetSocketId,
      caller: socketRef.current.id,
      sdp: peerConnection.localDescription,
    });
  };

  const handleReceiveOffer = async (payload) => {
    const peerConnection = createPeerConnection(payload.caller);
    const desc = new RTCSessionDescription(payload.sdp);
    await peerConnection.setRemoteDescription(desc);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socketRef.current.emit('answer', {
      target: payload.caller,
      sdp: peerConnection.localDescription,
    });
  };

  const handleReceiveAnswer = async (payload) => {
    const desc = new RTCSessionDescription(payload.sdp);
    if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
      try {
        await peerConnectionRef.current.setRemoteDescription(desc);
      } catch (e) {
        console.error("Error setting remote description for answer:", e);
      }
    }
  };

  const handleNewICECandidate = async (incoming) => {
    try {
      const candidate = new RTCIceCandidate(incoming.candidate);
      if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
        await peerConnectionRef.current.addIceCandidate(candidate);
      }
    } catch (e) {
      console.error("Error adding ICE candidate:", e);
    }
  };

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        
        // Update local video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Replace track on peer connection
        if (peerConnectionRef.current) {
          const videoSender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        }

        setIsScreenSharing(true);

        // Handle native "Stop Sharing" button in browser
        screenStream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.error("Error sharing screen:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    // Revert local video element
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    // Revert track on peer connection
    if (peerConnectionRef.current && localStreamRef.current) {
      const videoSender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
      const localVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoSender && localVideoTrack) {
        videoSender.replaceTrack(localVideoTrack);
      }
    }
    
    setIsScreenSharing(false);
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Modern Glassmorphic Container
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-5xl mx-auto bg-white/70 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl shadow-indigo-500/10 border border-white/50 dark:border-slate-800/50 overflow-hidden flex flex-col h-[650px]"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 bg-white/50 dark:bg-slate-800/50 rounded-2xl px-4 py-2 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Meeting ID:</span>
            <span className="text-base font-mono font-bold tracking-wider text-slate-800 dark:text-slate-200">{roomId}</span>
            <button 
              onClick={copyRoomId}
              className="ml-2 p-1.5 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors active:scale-95"
              title="Copy Meeting ID"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-700/30">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === "Call Connected" ? 'bg-green-500 animate-pulse' : 
              connectionStatus === "Waiting for User..." ? 'bg-amber-500 animate-pulse' : 
              'bg-blue-500 animate-pulse'
            }`} />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {connectionStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 md:p-6 overflow-hidden bg-slate-50/30 dark:bg-slate-950/30">
        <div className={`grid gap-4 md:gap-6 h-full transition-all duration-500 ${remoteUserConnected ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 max-w-5xl mx-auto'}`}>
          
          {/* Local Video Card */}
          <div className="flex flex-col h-full bg-white/40 dark:bg-slate-900/40 rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md">
            <div className="relative flex-1 bg-slate-900 overflow-hidden group">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
                style={{ transform: isScreenSharing ? 'scaleX(1)' : 'scaleX(-1)' }} // Mirror unless screen sharing
              />
              {isVideoOff && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 backdrop-blur-xl">
                  <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 p-1 mb-4 shadow-2xl">
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                      <span className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                        {currentUser?.displayName?.[0] || currentUser?.email?.[0] || 'U'}
                      </span>
                    </div>
                  </div>
                  <span className="text-slate-300 font-medium">Camera Disabled</span>
                </div>
              )}
              
              {isMuted && (
                <div className="absolute top-4 right-4 md:top-6 md:right-6 p-2 md:p-3 bg-red-500/90 backdrop-blur-md rounded-2xl text-white shadow-lg border border-red-400/50 animate-pulse">
                  <MicOff className="w-4 h-4 md:w-5 md:h-5" />
                </div>
              )}
            </div>
            
            {/* User Label Below Stream */}
            <div className="px-4 py-3 md:px-6 md:py-4 flex items-center gap-3 bg-white/60 dark:bg-slate-900/60 border-t border-slate-200/50 dark:border-slate-800/50">
              <img src={currentUser?.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=fallback'} alt="You" className="w-8 h-8 rounded-full shadow-sm" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">{currentUser?.displayName || 'You'} {isScreenSharing && '(Presenting)'}</span>
            </div>
          </div>

          {/* Remote Video Container */}
          <div className={`flex flex-col h-full bg-white/40 dark:bg-slate-900/40 rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md ${!remoteUserConnected && 'hidden md:flex'}`}>
            
            {/* The video element is ALWAYS mounted to ensure the ref exists when the stream arrives */}
            <div className={`relative flex-1 bg-slate-900 overflow-hidden ${remoteUserConnected ? 'block' : 'hidden'}`}>
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>

            {remoteUserConnected && (
              <div className="px-4 py-3 md:px-6 md:py-4 flex items-center gap-3 bg-white/60 dark:bg-slate-900/60 border-t border-slate-200/50 dark:border-slate-800/50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center shadow-md">
                  <span className="text-white text-sm font-bold">R</span>
                </div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">Remote Participant</span>
              </div>
            )}

            {/* Waiting State Overlay */}
            {!remoteUserConnected && (
              <div className="flex-1 flex items-center justify-center flex-col gap-4 md:gap-6 text-slate-500 dark:text-slate-400 p-6">
                <div className="relative">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center animate-pulse">
                    <Video className="w-8 h-8 md:w-10 md:h-10 text-indigo-500 dark:text-indigo-400 opacity-50" />
                  </div>
                  <div className="absolute -inset-4 border-2 border-indigo-500/20 rounded-full animate-ping" />
                </div>
                <div className="text-center">
                  <h3 className="text-base md:text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">Waiting for others</h3>
                  <p className="text-xs md:text-sm opacity-80">Share the Meeting ID for someone to join.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="p-6 bg-white/50 dark:bg-slate-900/50 border-t border-slate-200/50 dark:border-slate-800/50 backdrop-blur-xl">
        <div className="flex items-center justify-center gap-4 md:gap-6">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleMute}
            className={`p-4 rounded-2xl flex items-center justify-center transition-all ${
              isMuted 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25' 
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xl border border-slate-200/50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleVideo}
            className={`p-4 rounded-2xl flex items-center justify-center transition-all ${
              isVideoOff 
                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25' 
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xl border border-slate-200/50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleScreenShare}
            className={`p-4 rounded-2xl flex items-center justify-center transition-all ${
              isScreenSharing 
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' 
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 shadow-xl border border-slate-200/50 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {isScreenSharing ? <MonitorOff className="w-6 h-6" /> : <MonitorUp className="w-6 h-6" />}
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="px-8 py-4 rounded-2xl flex items-center justify-center bg-red-500 hover:bg-red-600 text-white font-bold transition-colors gap-3 shadow-xl shadow-red-500/30"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline">End Call</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default InlineVideoChat;
