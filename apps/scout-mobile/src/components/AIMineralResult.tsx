import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Share,
  Linking,
} from 'react-native';

interface MineralPrediction {
  mineral: string;
  probability: number;
  displayName: string;
}

interface PriceGuidance {
  mineralType: string;
  estimatedPriceUsdPerTonne: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  nearestBuyer?: {
    name: string;
    phone: string;
    distanceKm: number;
    operatingHours: string;
  };
}

interface AIResultProps {
  reportId: string;
  predictions: MineralPrediction[];
  confidence: number;
  priceGuidance: PriceGuidance;
  hazardAlerts: string[];
  onDispute: () => void;
}

export function AIMineralResult({
  reportId,
  predictions,
  confidence,
  priceGuidance,
  hazardAlerts,
  onDispute,
}: AIResultProps) {
  const [pulseAnim] = useState(new Animated.Value(1));

  const confidenceLevel = confidence > 0.8 ? 'high' : confidence > 0.5 ? 'medium' : 'low';
  const confidenceConfig = {
    high:   { label: 'High Confidence',   color: '#10B981', bg: '#064E3B' },
    medium: { label: 'Medium Confidence', color: '#F59E0B', bg: '#451A03' },
    low:    { label: 'Low Confidence',    color: '#EF4444', bg: '#450A0A' },
  }[confidenceLevel];

  const topPrediction = predictions[0];

  useEffect(() => {
    if (hazardAlerts.length > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [hazardAlerts.length]);

  const handleCallBuyer = () => {
    if (priceGuidance.nearestBuyer?.phone) {
      Linking.openURL(`tel:${priceGuidance.nearestBuyer.phone}`);
    }
  };

  const handleShare = async () => {
    const message =
      `🪨 AfriXplore Mineral Report\n\n` +
      `Mineral: ${topPrediction?.displayName || 'Unknown'}\n` +
      `Confidence: ${Math.round(confidence * 100)}%\n` +
      `Est. Value: USD ${priceGuidance.priceRangeLow.toLocaleString()}-${priceGuidance.priceRangeHigh.toLocaleString()}/tonne\n` +
      `Report ID: ${reportId}`;
    await Share.share({ message });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🤖 AI Analysis Complete</Text>
        <View style={[styles.confidenceBadge, { backgroundColor: confidenceConfig.bg }]}>
          <Text style={[styles.confidenceText, { color: confidenceConfig.color }]}>
            {confidenceConfig.label} — {Math.round(confidence * 100)}%
          </Text>
        </View>
      </View>

      <View style={styles.predictionsCard}>
        <Text style={styles.sectionTitle}>Mineral Predictions</Text>
        {predictions.map((pred, index) => (
          <View key={pred.mineral} style={styles.predictionRow}>
            <View style={styles.predictionRank}>
              <Text style={styles.predictionRankText}>#{index + 1}</Text>
            </View>
            <View style={styles.predictionInfo}>
              <Text style={styles.predictionName}>{pred.displayName}</Text>
              <View style={styles.probabilityBar}>
                <View style={[styles.probabilityFill, {
                  width: `${pred.probability * 100}%`,
                  backgroundColor: index === 0 ? '#F59E0B' : '#374151',
                }]} />
              </View>
            </View>
            <Text style={styles.predictionPct}>{Math.round(pred.probability * 100)}%</Text>
          </View>
        ))}
      </View>

      {hazardAlerts.length > 0 && (
        <Animated.View style={[styles.hazardCard, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.hazardTitle}>⚠️ SAFETY ALERT</Text>
          {hazardAlerts.map((alert, index) => (
            <Text key={index} style={styles.hazardText}>{alert}</Text>
          ))}
        </Animated.View>
      )}

      <View style={styles.priceCard}>
        <Text style={styles.sectionTitle}>💰 Price Guidance</Text>
        <View style={styles.priceMain}>
          <Text style={styles.priceLabel}>Estimated Value</Text>
          <Text style={styles.priceValue}>
            USD {priceGuidance.priceRangeLow.toLocaleString()} – {priceGuidance.priceRangeHigh.toLocaleString()}
          </Text>
          <Text style={styles.priceUnit}>per tonne (estimated)</Text>
        </View>

        {priceGuidance.nearestBuyer && (
          <View style={styles.buyerCard}>
            <Text style={styles.buyerLabel}>Nearest Certified Buyer</Text>
            <Text style={styles.buyerName}>{priceGuidance.nearestBuyer.name}</Text>
            <Text style={styles.buyerDistance}>📍 {priceGuidance.nearestBuyer.distanceKm}km away</Text>
            <Text style={styles.buyerHours}>🕐 {priceGuidance.nearestBuyer.operatingHours}</Text>
            <TouchableOpacity style={styles.callBuyerBtn} onPress={handleCallBuyer}>
              <Text style={styles.callBuyerText}>📞 Call {priceGuidance.nearestBuyer.phone}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>📤 Share Result</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.disputeBtn} onPress={onDispute}>
          <Text style={styles.disputeBtnText}>❓ Disagree with result?</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.disclaimer}>
        This AI analysis is for guidance only. Prices are estimates and vary by location,
        grade, and market conditions. Always verify with a certified buyer before selling.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0f1e' },
  content: { padding: 16, paddingBottom: 40 },
  header: { marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  confidenceBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  confidenceText: { fontSize: 13, fontWeight: '600' },
  predictionsCard: { backgroundColor: '#1f2937', borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#F9FAFB', marginBottom: 12 },
  predictionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  predictionRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#374151', justifyContent: 'center', alignItems: 'center' },
  predictionRankText: { color: '#9CA3AF', fontSize: 12, fontWeight: '700' },
  predictionInfo: { flex: 1 },
  predictionName: { color: '#F3F4F6', fontSize: 14, marginBottom: 4 },
  probabilityBar: { height: 6, backgroundColor: '#111827', borderRadius: 3, overflow: 'hidden' },
  probabilityFill: { height: '100%', borderRadius: 3 },
  predictionPct: { color: '#F59E0B', fontSize: 14, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  hazardCard: { backgroundColor: '#450A0A', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#EF4444' },
  hazardTitle: { color: '#FCA5A5', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  hazardText: { color: '#FCA5A5', fontSize: 13, lineHeight: 20, marginBottom: 4 },
  priceCard: { backgroundColor: '#1f2937', borderRadius: 16, padding: 16, marginBottom: 12 },
  priceMain: { backgroundColor: '#111827', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  priceLabel: { color: '#9CA3AF', fontSize: 12, marginBottom: 4 },
  priceValue: { color: '#F59E0B', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  priceUnit: { color: '#6B7280', fontSize: 11, marginTop: 4 },
  buyerCard: { backgroundColor: '#0D2137', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#1D4ED8' },
  buyerLabel: { color: '#93C5FD', fontSize: 12, marginBottom: 6 },
  buyerName: { color: '#F3F4F6', fontSize: 16, fontWeight: '600', marginBottom: 4 },
  buyerDistance: { color: '#9CA3AF', fontSize: 13, marginBottom: 2 },
  buyerHours: { color: '#9CA3AF', fontSize: 13, marginBottom: 12 },
  callBuyerBtn: { backgroundColor: '#1D4ED8', borderRadius: 10, padding: 12, alignItems: 'center' },
  callBuyerText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  shareBtn: { flex: 1, backgroundColor: '#064E3B', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#10B981' },
  shareBtnText: { color: '#10B981', fontWeight: '600', fontSize: 14 },
  disputeBtn: { flex: 1, backgroundColor: '#1f2937', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  disputeBtnText: { color: '#9CA3AF', fontSize: 13 },
  disclaimer: { color: '#4B5563', fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
