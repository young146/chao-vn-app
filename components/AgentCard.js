import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

const ACCENT = "#E91E63";

/**
 * AgentCard
 * Props:
 *   agent: {
 *     name, company, phone, kakaoId,
 *     licenseNumber, experienceYears,
 *     description, profileImage,
 *     city, district, addressDetail
 *   }
 *   onEdit: () => void
 */
export default function AgentCard({ agent, onEdit }) {
  if (!agent) return null;

  const handleCall = () => {
    if (!agent.phone) { Alert.alert("안내", "전화번호가 없습니다."); return; }
    Linking.openURL(`tel:${agent.phone.replace(/[^0-9+]/g, "")}`);
  };

  const handleKakao = () => {
    if (!agent.kakaoId) { Alert.alert("안내", "카카오 ID가 없습니다."); return; }
    Alert.alert("카카오톡", `카카오 ID: ${agent.kakaoId}\n\n카카오톡에서 검색하여 연락해주세요.`);
  };

  // 지역 문자열 조합
  const locationText = [agent.city, agent.district].filter(Boolean).join(" · ");

  return (
    <View style={styles.card}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Ionicons name="shield-checkmark" size={18} color={ACCENT} />
        <Text style={styles.cardTitle}>담당 중개인</Text>
        {onEdit && (
          <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
            <Ionicons name="create-outline" size={16} color={ACCENT} />
            <Text style={styles.editBtnText}>수정</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 프로필 행 */}
      <View style={styles.profileRow}>
        {/* 아바타 */}
        <View style={styles.avatarWrap}>
          {agent.profileImage ? (
            <Image
              source={{ uri: agent.profileImage }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="none"
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={28} color="#fff" />
            </View>
          )}
          {agent.licenseNumber ? (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          ) : null}
        </View>

        {/* 정보 */}
        <View style={styles.infoBlock}>
          <Text style={styles.agentName}>{agent.name}</Text>
          {agent.company ? (
            <Text style={styles.agentCompany}>{agent.company}</Text>
          ) : null}

          {/* 전화번호 표시 */}
          {agent.phone ? (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={13} color={ACCENT} />
              <Text style={styles.infoText}>{agent.phone}</Text>
            </View>
          ) : null}

          {/* 지역 표시 (도시 · 구군) */}
          {locationText ? (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={13} color="#555" />
              <Text style={styles.infoText}>{locationText}</Text>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            {agent.experienceYears > 0 && (
              <View style={styles.metaChip}>
                <Ionicons name="briefcase-outline" size={11} color={ACCENT} />
                <Text style={styles.metaChipText}>경력 {agent.experienceYears}년</Text>
              </View>
            )}
            {agent.licenseNumber ? (
              <View style={styles.metaChipGreen}>
                <Ionicons name="shield-checkmark-outline" size={11} color="#2E7D32" />
                <Text style={[styles.metaChipText, { color: "#2E7D32" }]}>공인중개사</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* 상세 주소 */}
      {agent.addressDetail ? (
        <View style={styles.addressRow}>
          <Ionicons name="map-outline" size={13} color="#888" />
          <Text style={styles.addressText}>{agent.addressDetail}</Text>
        </View>
      ) : null}

      {/* 소개 */}
      {agent.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {agent.description}
        </Text>
      ) : null}

      {/* 자격증 번호 */}
      {agent.licenseNumber ? (
        <View style={styles.licenseRow}>
          <Ionicons name="document-text-outline" size={13} color="#888" />
          <Text style={styles.licenseText}>자격증: {agent.licenseNumber}</Text>
        </View>
      ) : null}

      {/* 연락 버튼 */}
      <View style={styles.contactBtns}>
        <TouchableOpacity style={styles.callBtn} onPress={handleCall}>
          <Ionicons name="call" size={18} color="#fff" />
          <Text style={styles.callBtnText}>전화하기</Text>
        </TouchableOpacity>
        {agent.kakaoId ? (
          <TouchableOpacity style={styles.kakaoBtn} onPress={handleKakao}>
            <Text style={styles.kakaoBtnText}>💬 카카오톡</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FFDDE8",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#333", flex: 1 },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FCE4EC", paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 20,
  },
  editBtnText: { fontSize: 12, color: ACCENT, fontWeight: "600" },

  profileRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, marginBottom: 10 },

  avatarWrap: { position: "relative" },
  avatar: { width: 70, height: 70, borderRadius: 35, borderWidth: 2, borderColor: "#FFDDE8" },
  avatarFallback: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  verifiedBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#2E7D32",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },

  infoBlock: { flex: 1 },
  agentName: { fontSize: 17, fontWeight: "700", color: "#222" },
  agentCompany: { fontSize: 13, color: "#666", marginTop: 2 },

  infoRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 },
  infoText: { fontSize: 13, color: "#444", flex: 1 },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#FCE4EC", paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 20,
  },
  metaChipGreen: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#E8F5E9", paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 20,
  },
  metaChipText: { fontSize: 11, color: ACCENT, fontWeight: "600" },

  addressRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F9F9F9", borderRadius: 8,
    padding: 8, marginBottom: 8,
  },
  addressText: { fontSize: 12, color: "#666", flex: 1 },

  description: { fontSize: 13, color: "#555", lineHeight: 20, marginBottom: 10 },

  licenseRow: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F5F5F5", borderRadius: 8,
    padding: 8, marginBottom: 14,
  },
  licenseText: { fontSize: 12, color: "#666" },

  contactBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  callBtn: {
    flex: 1, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 6,
    backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 12,
  },
  callBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  kakaoBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#FEE500", borderRadius: 10, paddingVertical: 12,
  },
  kakaoBtnText: { color: "#3A1D00", fontSize: 14, fontWeight: "700" },
});
