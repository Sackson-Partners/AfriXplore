import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as ImageManipulator from 'expo-image-manipulator';
import { Audio } from 'expo-av';
import database from '../../../db/database';

const MINERALS = [
  { id: 'copper', label: 'Copper', icon: '🔴' },
  { id: 'gold', label: 'Gold', icon: '🟡' },
  { id: 'cobalt', label: 'Cobalt', icon: '🔵' },
  { id: 'lithium', label: 'Lithium', icon: '⚪' },
  { id: 'tin', label: 'Tin/Cassiterite', icon: '⬜' },
  { id: 'coltan', label: 'Coltan', icon: '⚫' },
  { id: 'graphite', label: 'Graphite', icon: '🖤' },
  { id: 'manganese', label: 'Manganese', icon: '🟤' },
  { id: 'uranium', label: 'Uranium', icon: '☢️' },
  { id: 'platinum', label: 'Platinum/PGM', icon: '⭐' },
  { id: 'chrome', label: 'Chrome', icon: '🔩' },
  { id: 'nickel', label: 'Nickel', icon: '🟢' },
  { id: 'wolframite', label: 'Wolframite', icon: '🔲' },
  { id: 'bauxite', label: 'Bauxite', icon: '🟥' },
  { id: 'other', label: 'Other', icon: '❓' },
];

const WORKING_TYPES = [
  { id: 'alluvial_river', label: 'River/Alluvial', icon: '🏞️' },
  { id: 'open_pit', label: 'Open Pit', icon: '⛏️' },
  { id: 'shallow_shaft', label: 'Shallow Shaft (<10m)', icon: '🕳️' },
  { id: 'deep_shaft', label: 'Deep Shaft', icon: '⬇️' },
  { id: 'tunnel', label: 'Tunnel/Adit', icon: '🚇' },
  { id: 'surface_pick', label: 'Surface Pick', icon: '🪨' },
];

export default function NewReportScreen() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedMineral, setSelectedMineral] = useState('');
  const [workingType, setWorkingType] = useState('');
  const [depthM, setDepthM] = useState(0);
  const [volumeEstimate, setVolumeEstimate] = useState('');
  const [hostRock, setHostRock] = useState('');
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const getLocation = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'AfriXplore needs your location to record mineral findings.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 100,
      });
    } catch {
      Alert.alert('GPS Error', 'Could not get location. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const capturePhoto = useCallback(async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
      exif: false,
    });

    if (!result.canceled && result.assets[0]) {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );
      setPhotos((prev) => [...prev, manipulated.uri]);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setTimeout(() => stopRecording(), 30_000);
    } catch {
      Alert.alert('Microphone Error', 'Cannot access microphone');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    setIsRecording(false);
    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    setRecordingUri(uri);
    recordingRef.current = null;
  }, []);

  const saveReport = useCallback(async () => {
    if (!location) { Alert.alert('Location Missing', 'Please capture your GPS location first'); return; }
    if (!selectedMineral) { Alert.alert('Mineral Required', 'Please select the mineral type'); return; }
    if (photos.length < 1) { Alert.alert('Photo Required', 'Please take at least one photo'); return; }

    setSubmitting(true);
    try {
      await database.write(async () => {
        await database.get('reports').create((report: any) => {
          report.mineralType = selectedMineral;
          report.workingType = workingType || 'surface_pick';
          report.depthEstimateM = depthM > 0 ? depthM : null;
          report.volumeEstimate = volumeEstimate || null;
          report.hostRock = hostRock || null;
          report.latitude = location.latitude;
          report.longitude = location.longitude;
          report.locationAccuracyM = location.accuracy;
          report.photos = photos.map((uri) => ({ uri }));
          report.voiceNotePath = recordingUri;
          report.status = 'draft';
          report.syncStatus = 'pending';
          report.createdAtLocal = Date.now();
          report.retryCount = 0;
        });
      });

      Alert.alert(
        '✅ Report Saved',
        'Your report has been saved. It will sync when you have internet.',
        [
          { text: 'View Reports', onPress: () => router.replace('/(tabs)/reports') },
          { text: 'New Report', onPress: () => {
            setStep(1); setPhotos([]); setSelectedMineral('');
            setWorkingType(''); setDepthM(0); setLocation(null); setRecordingUri(null);
          }},
        ]
      );
    } catch {
      Alert.alert('Save Failed', 'Could not save report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [location, selectedMineral, photos, workingType, depthM, volumeEstimate, hostRock, recordingUri]);

  return (
    <View style={styles.container}>
      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map((s) => (
          <View key={s} style={[styles.progressStep, s <= step ? styles.progressStepActive : styles.progressStepInactive]} />
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>📸 Photos & Location</Text>
            <Text style={styles.stepSubtitle}>Take 2+ photos of the mineral sample</Text>
            <View style={styles.photoGrid}>
              {photos.map((uri, index) => (
                <TouchableOpacity key={index} onPress={() => setPhotos((prev) => prev.filter((_, i) => i !== index))} style={styles.photoThumb}>
                  <Text style={styles.photoThumbText}>📷 {index + 1}</Text>
                </TouchableOpacity>
              ))}
              {photos.length < 5 && (
                <TouchableOpacity onPress={capturePhoto} style={styles.addPhotoBtn}>
                  <Text style={styles.addPhotoBtnText}>+ Photo</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.photoHint}>
              {photos.length < 1 ? '⚠️ Minimum 1 photo required' : `✅ ${photos.length} photo(s) captured`}
            </Text>
            {location ? (
              <View style={styles.locationConfirmed}>
                <Text style={styles.locationText}>✅ Location captured</Text>
                <Text style={styles.locationAccuracy}>Accuracy: ±{Math.round(location.accuracy)}m</Text>
              </View>
            ) : (
              <TouchableOpacity onPress={getLocation} style={styles.gpsButton}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.gpsButtonText}>📡 Capture GPS Location</Text>}
              </TouchableOpacity>
            )}
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep(2)} disabled={!location || photos.length < 1}
                style={[styles.nextButton, (!location || photos.length < 1) && styles.nextButtonDisabled]}>
                <Text style={styles.nextButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>⛏️ What Did You Find?</Text>
            <Text style={styles.stepSubtitle}>Select the mineral type</Text>
            <View style={styles.mineralGrid}>
              {MINERALS.map((mineral) => (
                <TouchableOpacity key={mineral.id} onPress={() => setSelectedMineral(mineral.id)}
                  style={[styles.mineralCard, selectedMineral === mineral.id && styles.mineralCardSelected]}>
                  <Text style={styles.mineralIcon}>{mineral.icon}</Text>
                  <Text style={styles.mineralLabel}>{mineral.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.backButton}><Text style={styles.backButtonText}>← Back</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setStep(3)} disabled={!selectedMineral}
                style={[styles.nextButton, !selectedMineral && styles.nextButtonDisabled]}>
                <Text style={styles.nextButtonText}>Next →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>🔍 Working Details</Text>
            <Text style={styles.sectionLabel}>Type of Mining</Text>
            <View style={styles.workingGrid}>
              {WORKING_TYPES.map((wt) => (
                <TouchableOpacity key={wt.id} onPress={() => setWorkingType(wt.id)}
                  style={[styles.workingCard, workingType === wt.id && styles.workingCardSelected]}>
                  <Text style={styles.workingIcon}>{wt.icon}</Text>
                  <Text style={styles.workingLabel}>{wt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Estimated Depth: {depthM}m</Text>
            <View style={styles.sliderContainer}>
              {[0, 5, 10, 20, 50, 100, 200].map((d) => (
                <TouchableOpacity key={d} onPress={() => setDepthM(d)}
                  style={[styles.depthButton, depthM === d && styles.depthButtonSelected]}>
                  <Text style={styles.depthButtonText}>{d}m</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Volume Estimate</Text>
            <View style={styles.volumeRow}>
              {['small', 'medium', 'large'].map((v) => (
                <TouchableOpacity key={v} onPress={() => setVolumeEstimate(v)}
                  style={[styles.volumeButton, volumeEstimate === v && styles.volumeButtonSelected]}>
                  <Text style={styles.volumeButtonText}>
                    {v === 'small' ? '📦 <1t' : v === 'medium' ? '🚛 1-10t' : '⛏️ >10t'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionLabel}>Voice Note (optional, 30s)</Text>
            <TouchableOpacity onPress={isRecording ? stopRecording : startRecording}
              style={[styles.voiceButton, isRecording && styles.voiceButtonRecording]}>
              <Text style={styles.voiceButtonText}>{isRecording ? '⏹ Stop Recording' : '🎙️ Record Note'}</Text>
            </TouchableOpacity>
            {recordingUri && <Text style={styles.recordingConfirmed}>✅ Voice note recorded</Text>}
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep(2)} style={styles.backButton}><Text style={styles.backButtonText}>← Back</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setStep(4)} style={styles.nextButton}><Text style={styles.nextButtonText}>Review →</Text></TouchableOpacity>
            </View>
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>✅ Review & Submit</Text>
            <View style={styles.reviewCard}>
              {[
                { label: 'Mineral', value: selectedMineral },
                { label: 'Working Type', value: workingType || 'Not specified' },
                { label: 'Depth', value: `${depthM}m` },
                { label: 'Volume', value: volumeEstimate || 'Not specified' },
                { label: 'Photos', value: `${photos.length} captured` },
                { label: 'Voice Note', value: recordingUri ? 'Recorded' : 'None' },
                { label: 'GPS', value: location ? `±${Math.round(location.accuracy)}m accuracy` : 'Missing' },
              ].map(({ label, value }) => (
                <View key={label} style={styles.reviewRow}>
                  <Text style={styles.reviewLabel}>{label}</Text>
                  <Text style={styles.reviewValue}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={styles.offlineNotice}>
              <Text style={styles.offlineNoticeText}>
                📱 Report saved to device. Will sync automatically when internet is available.
              </Text>
            </View>
            <View style={styles.navRow}>
              <TouchableOpacity onPress={() => setStep(3)} style={styles.backButton}><Text style={styles.backButtonText}>← Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveReport} style={styles.submitButton} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Report ✓</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  progressBar: { flexDirection: 'row', padding: 16, gap: 8 },
  progressStep: { flex: 1, height: 4, borderRadius: 2 },
  progressStepActive: { backgroundColor: '#F59E0B' },
  progressStepInactive: { backgroundColor: '#1f2937' },
  stepTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  stepSubtitle: { fontSize: 14, color: '#9CA3AF', marginBottom: 24 },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: '#E5E7EB', marginBottom: 12, marginTop: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  photoThumb: { width: 80, height: 80, backgroundColor: '#1f2937', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F59E0B' },
  photoThumbText: { color: '#F59E0B', fontSize: 12 },
  addPhotoBtn: { width: 80, height: 80, backgroundColor: '#1f2937', borderRadius: 8, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#374151', borderStyle: 'dashed' },
  addPhotoBtnText: { color: '#6B7280', fontSize: 12 },
  photoHint: { color: '#9CA3AF', fontSize: 12, marginBottom: 20 },
  locationConfirmed: { backgroundColor: '#065F46', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#10B981', marginBottom: 16 },
  locationText: { color: '#10B981', fontWeight: '600' },
  locationAccuracy: { color: '#6EE7B7', fontSize: 12, marginTop: 4 },
  gpsButton: { backgroundColor: '#1D4ED8', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  gpsButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  navRow: { flexDirection: 'row', marginTop: 24, gap: 8 },
  nextButton: { backgroundColor: '#F59E0B', borderRadius: 12, padding: 16, alignItems: 'center', flex: 1 },
  nextButtonDisabled: { backgroundColor: '#374151' },
  nextButtonText: { color: '#000', fontWeight: '700', fontSize: 16 },
  backButton: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16, alignItems: 'center', flex: 0.4, marginRight: 8 },
  backButtonText: { color: '#9CA3AF', fontWeight: '600' },
  mineralGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  mineralCard: { width: '30%', backgroundColor: '#1f2937', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  mineralCardSelected: { borderColor: '#F59E0B' },
  mineralIcon: { fontSize: 24, marginBottom: 4 },
  mineralLabel: { color: '#E5E7EB', fontSize: 11, textAlign: 'center' },
  workingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  workingCard: { width: '47%', backgroundColor: '#1f2937', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  workingCardSelected: { borderColor: '#F59E0B', backgroundColor: '#292524' },
  workingIcon: { fontSize: 24, marginBottom: 4 },
  workingLabel: { color: '#E5E7EB', fontSize: 12, textAlign: 'center' },
  sliderContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  depthButton: { backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#374151' },
  depthButtonSelected: { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
  depthButtonText: { color: '#E5E7EB', fontSize: 13 },
  volumeRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  volumeButton: { flex: 1, backgroundColor: '#1f2937', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: 'transparent' },
  volumeButtonSelected: { borderColor: '#F59E0B' },
  volumeButtonText: { color: '#E5E7EB', fontSize: 12, textAlign: 'center' },
  voiceButton: { backgroundColor: '#1f2937', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 8, borderWidth: 2, borderColor: '#374151' },
  voiceButtonRecording: { backgroundColor: '#7F1D1D', borderColor: '#EF4444' },
  voiceButtonText: { color: '#E5E7EB', fontWeight: '600' },
  recordingConfirmed: { color: '#10B981', fontSize: 12, marginBottom: 16 },
  reviewCard: { backgroundColor: '#1f2937', borderRadius: 16, padding: 20, marginBottom: 16 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#374151' },
  reviewLabel: { color: '#9CA3AF', fontSize: 14 },
  reviewValue: { color: '#F3F4F6', fontSize: 14, fontWeight: '500' },
  offlineNotice: { backgroundColor: '#1E3A5F', borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#1D4ED8' },
  offlineNoticeText: { color: '#93C5FD', fontSize: 13, lineHeight: 20 },
  submitButton: { backgroundColor: '#10B981', borderRadius: 12, padding: 16, alignItems: 'center', flex: 1 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
