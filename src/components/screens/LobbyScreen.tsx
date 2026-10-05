import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useGame } from '../../context/GameContext';
import { copyText, shareOrCopy } from '../../lib/clipboard';
import { buildRoomLink } from '../../lib/roomLink';
import { usePlayerOnline } from '../../hooks/usePlayerPresence';
import { RoomQrCode } from '../ui/RoomQrCode';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Copy, Check, UserCheck, ArrowLeft, Loader2, Sparkles, UserPlus, Share2, QrCode, WifiOff, Trophy } from 'lucide-react';

export const LobbyScreen: React.FC = () => {
  const {
    roomCode,
    myPlayerId,
    player1,
    player2,
    toggleReady,
    isStarting,
    leaveRoom,
    opponentPlayer,
    roomTournamentCode,
    errorMsg,
  } = useGame();
  const [showQr, setShowQr] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const opponentOnline = usePlayerOnline(opponentPlayer?.lastSeenAt);
  const roomLink = buildRoomLink(roomCode);

  const handleShare = async () => {
    const result = await shareOrCopy({
      title: 'TEKNOFEST 1v1 Bilgi Arenası',
      text: `Benimle 1v1 bilgi düellosuna gel! Oda kodu: ${roomCode}`,
      url: roomLink,
    });
    if (result === 'copied') {
      setShareNote('Davet linki kopyalandı');
      setTimeout(() => setShareNote(null), 2500);
    }
  };

  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    // Works over plain HTTP too (LAN demos), where navigator.clipboard is undefined.
    if (await copyText(roomCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasTwoPlayers = Boolean(player1 && player1.id && player2 && player2.id);
  const isMePlayer1 = myPlayerId === player1.id;
  const myPlayerObj = isMePlayer1 ? player1 : player2;

  const bothReady = Boolean(player1.isReady && player2 && player2.isReady);
  const onlyOneReady = (player1.isReady && !player2?.isReady) || (!player1.isReady && player2?.isReady);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center space-y-4 w-full max-w-md mx-auto py-2 px-1"
    >
      {/* Navigation Top Action */}
      <div className="flex items-center justify-between w-full">
        <button
          onClick={() => void leaveRoom()}
          className="flex items-center gap-1.5 text-xs font-bold font-subheading text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> {roomTournamentCode ? 'Turnuvaya Dön (Hükmen Mağlubiyet)' : 'Ana Menü'}
        </button>
        <span className="text-xs font-bold font-subheading text-cyan-400/80 uppercase">
          {roomTournamentCode ? 'TURNUVA MAÇI' : 'LOBİ BEKLEME ALANI'}
        </span>
      </div>

      {errorMsg && (
        <p role="alert" className="w-full text-xs text-rose-300 text-center font-semibold">{errorMsg}</p>
      )}

      {roomTournamentCode ? (
        <Card variant="purple" glow className="w-full text-center space-y-1.5">
          <Trophy className="w-6 h-6 text-amber-400 mx-auto" />
          <p className="text-xs text-slate-300 font-medium">
            Turnuva eşleşmen hazır. İkiniz de <span className="text-cyan-400 font-bold">HAZIRIM</span> deyince maç başlar.
          </p>
        </Card>
      ) : (
      <Card variant="cyan" glow className="w-full text-center space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 font-subheading">
          ODA KODU (6 HANELİ)
        </span>

        <div className="flex items-center justify-center gap-3">
          <div className="text-3xl font-black font-heading tracking-widest text-cyan-300 text-glow-cyan bg-slate-950/80 px-6 py-2.5 rounded-xl border border-cyan-500/40">
            {roomCode}
          </div>
          <button
            onClick={handleCopyCode}
            className="p-3 rounded-xl bg-cyan-950 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900 transition-all box-glow-cyan cursor-pointer"
            title="Kodu Kopyala"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 font-medium">
          Diğer oyuncunun odaya katılması için bu 6 haneli kodu paylaşın.
        </p>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => void handleShare()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold hover:border-cyan-500/60 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" /> Davet Linki
          </button>
          <button
            onClick={() => setShowQr((v) => !v)}
            aria-expanded={showQr}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold hover:border-cyan-500/60 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" /> {showQr ? 'QR Gizle' : 'QR Göster'}
          </button>
        </div>
        {shareNote && <p className="text-[11px] text-emerald-400 font-bold">{shareNote}</p>}
        {showQr && (
          <div className="flex justify-center pt-1">
            <RoomQrCode url={roomLink} size={176} />
          </div>
        )}
      </Card>
      )}

      {/* Players Showdown Preview Slot Cards */}
      <div className="grid grid-cols-2 gap-3 w-full">
        {/* Player 1 Card (Host) */}
        <div
          className={`cyber-card rounded-2xl p-4 flex flex-col items-center space-y-3 border transition-all ${
            player1.isReady
              ? 'border-emerald-500/60 bg-emerald-950/30 shadow-lg box-glow-cyan'
              : 'border-cyan-500/40 bg-slate-900/60'
          }`}
        >
          <Badge variant="cyan" size="sm">
            Ev Sahibi
          </Badge>
          {!isMePlayer1 && !opponentOnline && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300" title="Son 45 saniyedir sinyal yok">
              <WifiOff className="w-3 h-3" /> Bağlantı koptu
            </span>
          )}

          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl shadow-lg box-glow-cyan">
              {player1.avatar}
            </div>
            {player1.isReady && (
              <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-black rounded-full shadow-md">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </span>
            )}
          </div>

          <div className="text-center w-full">
            <h3 className="text-sm font-bold text-white truncate font-subheading">
              {player1.name} {isMePlayer1 && '(Sen)'}
            </h3>
            <span
              className={`text-[11px] font-bold uppercase tracking-wider block mt-1 ${
                player1.isReady ? 'text-emerald-400 font-extrabold' : 'text-amber-400'
              }`}
            >
              {player1.isReady ? '✓ HAZIR' : 'BEKLİYOR'}
            </span>
          </div>
        </div>

        {/* Player 2 Card (Guest / Opponent) */}
        {player2 && player2.id ? (
          <div
            className={`cyber-card rounded-2xl p-4 flex flex-col items-center space-y-3 border transition-all ${
              player2.isReady
                ? 'border-emerald-500/60 bg-emerald-950/30 shadow-lg box-glow-purple'
                : 'border-purple-500/40 bg-slate-900/60'
            }`}
          >
            <Badge variant="purple" size="sm">
              Katılımcı
            </Badge>
            {isMePlayer1 && !opponentOnline && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-300" title="Son 45 saniyedir sinyal yok">
                <WifiOff className="w-3 h-3" /> Bağlantı koptu
              </span>
            )}

            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-3xl shadow-lg box-glow-purple">
                {player2.avatar}
              </div>
              {player2.isReady && (
                <span className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-black rounded-full shadow-md">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </span>
              )}
            </div>

            <div className="text-center w-full">
              <h3 className="text-sm font-bold text-white truncate font-subheading">
                {player2.name} {!isMePlayer1 && '(Sen)'}
              </h3>
              <span
                className={`text-[11px] font-bold uppercase tracking-wider block mt-1 ${
                  player2.isReady ? 'text-emerald-400 font-extrabold' : 'text-amber-400'
                }`}
              >
                {player2.isReady ? '✓ HAZIR' : 'BEKLİYOR'}
              </span>
            </div>
          </div>
        ) : (
          <div className="cyber-card rounded-2xl p-4 flex flex-col items-center justify-center space-y-2 border border-dashed border-slate-800 bg-slate-950/30 text-center">
            <div className="w-12 h-12 rounded-full border border-slate-800 flex items-center justify-center text-slate-600 animate-pulse">
              <UserPlus className="w-6 h-6" />
            </div>
            <span className="text-xs font-bold text-slate-500 font-subheading">
              2. Oyuncu Katılımı Bekleniyor...
            </span>
          </div>
        )}
      </div>

      {/* Status Alert Banner */}
      <div className="w-full text-center">
        {!hasTwoPlayers ? (
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-medium flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            <span>Odada 2 gerçek oyuncu olması bekleniyor...</span>
          </div>
        ) : bothReady ? (
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-extrabold font-subheading flex items-center justify-center gap-2 box-glow-cyan"
          >
            <Sparkles className="w-4 h-4 text-emerald-400 animate-bounce" />
            <span>HER İKİ OYUNCU DA HAZIR! MAÇ BAŞLIYOR...</span>
          </motion.div>
        ) : onlyOneReady ? (
          <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-xs font-bold font-subheading flex items-center justify-center gap-2 box-glow-cyan">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            <span>Rakip bekleniyor... Her iki oyuncu da "HAZIRIM" butonuna basmalı.</span>
          </div>
        ) : (
          <div className="p-2.5 text-xs text-slate-400 font-medium">
            Maçın başlaması için her iki oyuncunun da <span className="text-cyan-400 font-bold">HAZIRIM</span> butonuna basması gereklidir.
          </div>
        )}
      </div>

      {/* Action Area */}
      <div className="w-full space-y-2.5 pt-1">
        <Button
          variant={myPlayerObj?.isReady ? 'ghost' : 'cyan'}
          size="lg"
          fullWidth
          onClick={toggleReady}
          disabled={isStarting || !hasTwoPlayers}
        >
          <UserCheck className="w-5 h-5" />
          <span>{myPlayerObj?.isReady ? 'HAZIR DEĞİLİM' : 'HAZIRIM'}</span>
        </Button>
      </div>
    </motion.div>
  );
};
