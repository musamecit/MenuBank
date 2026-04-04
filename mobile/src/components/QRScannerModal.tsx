import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

/** İlk http(s) URL parçasını çıkar (QR bazen metin + URL içerir) */
function extractUrlCandidate(raw: string): string {
  const s = raw.replace(/^\uFEFF/g, '').trim();
  const m = s.match(/https?:\/\/[^\s<>"']+/i);
  if (m) return m[0].trim();
  return s;
}

/**
 * Menü linki: http(s) + geçerli host. Şemasız `ornek.com/yol` için https eklenir.
 * Eski regex alt alan adlarını / uzun TLD’leri yanlış reddedebiliyordu.
 */
function normalizeMenuUrlFromScan(raw: string): string | null {
  let s = extractUrlCandidate(raw).replace(/\u200B/g, '');
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    const hostPath = s.replace(/^\/+/, '');
    if (!/^[\w.-]+\.[a-z0-9.-]{2,}/i.test(hostPath.split('/')[0] ?? '')) return null;
    s = `https://${hostPath}`;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.replace(/\.$/, '');
    if (!host || !host.includes('.')) return null;
    return u.toString();
  } catch {
    return null;
  }
}

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (url: string) => void;
}

export default function QRScannerModal({ visible, onClose, onScan }: QRScannerModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [scanError, setScanError] = useState(false);
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setMountError(null);
      setScanError(false);
      scannedRef.current = false;
    }
  }, [visible]);

  const handleMountError = useCallback((err: { message?: string }) => {
    setMountError(err?.message ?? t('addMenu.cameraError'));
  }, [t]);

  const handleClose = useCallback(() => {
    setScanned(false);
    setScanError(false);
    scannedRef.current = false;
    onClose();
  }, [onClose]);

  const dismissScanError = useCallback(() => {
    setScanError(false);
    scannedRef.current = false;
  }, []);

  const handleBarCodeScanned = useCallback(
    ({ data }: { type: string; data: string }) => {
      if (scannedRef.current) return;
      const trimmed = (data || '').trim();
      const url = normalizeMenuUrlFromScan(trimmed);
      if (url) {
        scannedRef.current = true;
        setScanned(true);
        onScan(url.replace(/^(https?):\/\//i, (_, p) => `${p.toLowerCase()}://`));
        handleClose();
      } else {
        scannedRef.current = true;
        setScanError(true);
      }
    },
    [onScan, handleClose],
  );

  const cameraScanEnabled = !scanned && !scanError;

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible animationType="slide" transparent onRequestClose={handleClose}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.text }]}>{t('addMenu.cameraLoading')}</Text>
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain ?? true;
    return (
      <Modal visible animationType="slide" transparent onRequestClose={handleClose}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.text }]}>
            {t('addMenu.cameraPermissionRequired')}
          </Text>
          {canAskAgain ? (
            <TouchableOpacity
              style={[styles.permBtn, { backgroundColor: colors.accent }]}
              onPress={requestPermission}
            >
              <Text style={styles.permBtnText}>{t('explore.grantPermission')}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={[styles.message, { color: colors.textSecondary, marginTop: 0, fontSize: 14 }]}>
                {t('addMenu.cameraPermissionPermanentlyDenied')}
              </Text>
              <TouchableOpacity
                style={[styles.permBtn, { backgroundColor: colors.accent }]}
                onPress={() => Linking.openSettings()}
              >
                <Text style={styles.permBtnText}>{t('addMenu.openSettings')}</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  if (mountError) {
    return (
      <Modal visible animationType="slide" transparent onRequestClose={handleClose}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <Text style={[styles.message, { color: colors.text }]}>{mountError}</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Text style={[styles.closeText, { color: colors.textSecondary }]}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.cameraWrap, { backgroundColor: '#000' }]}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={cameraScanEnabled ? handleBarCodeScanned : undefined}
            onMountError={handleMountError}
          />
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.scanFrame} />
            <Text style={styles.hint}>{t('addMenu.scanQRHint')}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.closeIconBtn,
              { backgroundColor: 'rgba(0,0,0,0.5)', top: Math.max(insets.top, 16) },
            ]}
            onPress={handleClose}
            accessibilityLabel={t('common.close')}
            accessibilityRole="button"
          >
            <X size={24} color="#fff" />
          </TouchableOpacity>
          {scanError ? (
            <View style={styles.errorOverlay} pointerEvents="auto">
              <View style={[styles.errorCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.errorTitle, { color: colors.text }]}>{t('addMenu.invalidQR')}</Text>
                <Text style={[styles.errorBody, { color: colors.textSecondary }]}>
                  {t('addMenu.invalidQRMessage')}
                </Text>
                <TouchableOpacity
                  style={[styles.errorOkBtn, { backgroundColor: colors.accent }]}
                  onPress={dismissScanError}
                  activeOpacity={0.85}
                >
                  <Text style={styles.errorOkText}>{t('common.ok')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  permBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  closeBtn: { marginTop: 16 },
  closeText: { fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraWrap: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  hint: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 16,
  },
  closeIconBtn: {
    position: 'absolute',
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorOkBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  errorOkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
