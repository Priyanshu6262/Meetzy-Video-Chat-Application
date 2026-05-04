import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const VideoChat = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [copied, setCopied] = useState(false);
  const [remoteUserConnected, setRemoteUserConnected] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }

    let isMounted = true;
    const socket = io('http://localhost:5000');
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

        socket.emit('join-room', roomId, currentUser.uid);

        socket.on('user-connected', async (userId, socketId) => {
          if (!isMounted) return;
          console.log('User connected:', userId);
          setRemoteUserConnected(true);
          await callUser(socketId);
        });

        socket.on('offer', async (payload) => {
          if (!isMounted) return;
          console.log('Received offer');
          setRemoteUserConnected(true);
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
        if (isMounted) {
          alert("Cannot access Camera or Microphone. Please check your permissions.");
        }
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
    };
  }, [roomId, currentUser, navigate]);

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

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current);
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
      if (peerConnectionRef.current) {
        // Only add ICE candidate if remote description is set, otherwise queue it (or in this simple implementation, just ignore/wait)
        if (peerConnectionRef.current.remoteDescription) {
          await peerConnectionRef.current.addIceCandidate(candidate);
        }
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

  const endCall = () => {
    navigate('/');
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 pt-16">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-slate-800 dark:text-slate-200">Meeting Info:</span>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <span className="text-sm font-mono text-slate-600 dark:text-slate-400">{roomId}</span>
            <button 
              onClick={copyRoomId}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
              title="Copy Meeting Code"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-500" />}
            </button>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 p-4 md:p-6 overflow-hidden">
        <div className={`grid gap-4 h-full ${remoteUserConnected ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-4xl mx-auto'}`}>
          
          {/* Local Video */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800">
            <video 
              ref={localVideoRef} 
              autoPlay 
              playsInline 
              muted 
              className={`w-full h-full object-cover ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
              style={{ transform: 'scaleX(-1)' }}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center border-4 border-slate-600">
                  <span className="text-3xl font-bold text-white">
                    {currentUser?.displayName?.[0] || currentUser?.email?.[0] || 'U'}
                  </span>
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-lg text-white text-sm font-medium">
              You
            </div>
            {isMuted && (
              <div className="absolute top-4 right-4 p-2 bg-red-500 rounded-full text-white">
                <MicOff className="w-4 h-4" />
              </div>
            )}
          </div>

          {/* Remote Video (Shows placeholder if no one connected) */}
          {remoteUserConnected ? (
            <div className="relative rounded-2xl overflow-hidden bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800">
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-lg text-white text-sm font-medium">
                Participant
              </div>
            </div>
          ) : (
            <div className="hidden md:flex relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 items-center justify-center flex-col gap-4 text-slate-500 dark:text-slate-400">
              <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <p>Waiting for others to join...</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="h-24 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-center gap-4 md:gap-6 px-4">
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleMute}
          className={`p-4 rounded-full flex items-center justify-center transition-colors ${
            isMuted 
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </motion.button>
        
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleVideo}
          className={`p-4 rounded-full flex items-center justify-center transition-colors ${
            isVideoOff 
              ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          {isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
        </motion.button>
        
        <motion.button 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={endCall}
          className="p-4 px-8 rounded-full flex items-center justify-center bg-red-600 hover:bg-red-700 text-white font-medium transition-colors gap-2 shadow-lg shadow-red-500/20"
        >
          <PhoneOff className="w-5 h-5" />
          <span className="hidden sm:inline">Leave</span>
        </motion.button>
      </div>
    </div>
  );
};

export default VideoChat;
