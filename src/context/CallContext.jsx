import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const CallProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { socket, selectedUser } = useChat();

  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, incoming, connected
  const [callerInfo, setCallerInfo] = useState(null); // { callerUid, callerName, callerPhoto }
  const [receiverInfo, setReceiverInfo] = useState(null); // { uid, name, photo }
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const timeoutRef = useRef(null);

  const cleanupCall = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setCallerInfo(null);
    setReceiverInfo(null);
  }, []);

  const createPeerConnection = useCallback((targetUid) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('call:signal', {
          targetUid,
          signalData: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanupCall();
      }
    };

    return pc;
  }, [socket, cleanupCall]);

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsCameraOn(true);
      setIsMicOn(true);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      return null;
    }
  };

  // Incoming call socket listeners
  useEffect(() => {
    if (!socket || !currentUser) return;

    socket.on('call:incoming', ({ callerUid, callerName, callerPhoto }) => {
      if (callStatus !== 'idle') {
        // Automatically reject if already in a call
        socket.emit('call:reject', { callerUid });
        return;
      }
      setCallerInfo({ callerUid, callerName, callerPhoto });
      setCallStatus('incoming');
    });

    socket.on('call:accepted', async ({ receiverUid }) => {
      setCallStatus('connected');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const pc = createPeerConnection(receiverUid);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:signal', {
          targetUid: receiverUid,
          signalData: { type: 'offer', offer }
        });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    });

    socket.on('call:rejected', () => {
      cleanupCall();
    });

    socket.on('call:missed', () => {
      cleanupCall();
    });

    socket.on('call:ended', () => {
      cleanupCall();
    });

    socket.on('call:signal', async ({ senderUid, signalData }) => {
      const pc = pcRef.current;
      if (!pc) return;

      try {
        if (signalData.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('call:signal', {
            targetUid: senderUid,
            signalData: { type: 'answer', answer }
          });
        } else if (signalData.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.answer));
        } else if (signalData.type === 'candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        }
      } catch (err) {
        console.error('Error handling signal:', err);
      }
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:accepted');
      socket.off('call:rejected');
      socket.off('call:missed');
      socket.off('call:ended');
      socket.off('call:signal');
    };
  }, [socket, callStatus, currentUser, createPeerConnection, cleanupCall]);

  const initiateCall = async (user) => {
    if (!socket || callStatus !== 'idle') return;
    const stream = await startLocalStream();
    if (!stream) return;

    setReceiverInfo(user);
    setCallStatus('calling');
    
    socket.emit('call:initiate', { receiverUid: user.uid });

    timeoutRef.current = setTimeout(() => {
      if (pcRef.current?.connectionState !== 'connected') {
        socket.emit('call:timeout', { targetUid: user.uid });
        cleanupCall();
      }
    }, 7000);
  };

  const acceptCall = async () => {
    if (!socket || !callerInfo) return;
    const stream = await startLocalStream();
    if (!stream) {
      socket.emit('call:reject', { callerUid: callerInfo.callerUid });
      cleanupCall();
      return;
    }
    
    setCallStatus('connected');
    createPeerConnection(callerInfo.callerUid);
    socket.emit('call:accept', { callerUid: callerInfo.callerUid });
  };

  const rejectCall = () => {
    if (!socket || !callerInfo) return;
    socket.emit('call:reject', { callerUid: callerInfo.callerUid });
    cleanupCall();
  };

  const endCall = () => {
    if (!socket) return;
    const targetUid = callStatus === 'calling' || callStatus === 'connected' && receiverInfo 
      ? receiverInfo.uid 
      : callerInfo?.callerUid;
      
    if (targetUid) {
      socket.emit('call:end', { targetUid });
    }
    cleanupCall();
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  };

  return (
    <CallContext.Provider value={{
      callStatus,
      callerInfo,
      receiverInfo,
      localStream,
      remoteStream,
      isCameraOn,
      isMicOn,
      initiateCall,
      acceptCall,
      rejectCall,
      endCall,
      toggleCamera,
      toggleMic
    }}>
      {children}
    </CallContext.Provider>
  );
};
