import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

const isValidUrl = (str: string): boolean => /^https?:\/\//i.test(str.trim());

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
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setMountError(null);
      scannedRef.current = false;
    }
  }, [visible]);

  const handleMountError = useCallback((err: { message?: string }) => {
    setMountError(err?.message ?? t('addMenu.cameraError'));
  }, [t]);

  const handleClose = useCallback(() => {
    setScanned(false);
    scannedRef.current = false;
    onClose();
  }, [onClose]);

  const handleBarCodeScanned = useCallback(
    ({ data }: { type: string; data: string }) => {
      if (scannedRef.current) return;
      const trimmed = (data || '').trim();
      if (isValidUrl(trimmed)) {
        scannedRef.current = true;
        setScanned(true);
        onScan(trimmed);
        handleClose();
      } else {
        Alert.alert(
          t('addMenu.invalidQR'),
          t('addMenu.invalidQRMessage'),
          [{ text: t('common.ok') }],
        );
      }
    },
    [onScan, handleClose, t],
  );

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
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
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
});
