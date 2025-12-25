import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { CITIES, INTEREST_OPTIONS } from "../../utils/constants";
import { getDistrictsByCity, getApartmentsByDistrict } from "../../utils/vietnamLocations";

export default function ProfileEditForm({
    user,
    profileImage,
    uploading,
    name, setName,
    email, setEmail,
    phone, setPhone,
    ageGroup, setAgeGroup,
    gender, setGender,
    selectedCity, setSelectedCity,
    selectedDistrict, setSelectedDistrict,
    selectedApartment, setSelectedApartment,
    detailedAddress, setDetailedAddress,
    postalCode, setPostalCode,
    residencePeriod, setResidencePeriod,
    residencePurpose, setResidencePurpose,
    occupation, setOccupation,
    kakaoId, setKakaoId,
    zaloId, setZaloId,
    facebook, setFacebook,
    instagram, setInstagram,
    interests, toggleInterest,
    onPickImage,
    onSave,
    onCancel,
    onDelete,
    isSaving,
    isAdmin,
}) {
    const districts = selectedCity ? getDistrictsByCity(selectedCity) : [];
    const apartments = selectedCity && selectedDistrict ? getApartmentsByDistrict(selectedCity, selectedDistrict) : [];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.profileHeader}>
                <TouchableOpacity onPress={onPickImage} style={styles.avatarContainer}>
                    {uploading ? (
                        <View style={styles.avatar}>
                            <ActivityIndicator size="large" color="#fff" />
                        </View>
                    ) : profileImage ? (
                        <Image
                            source={{ uri: profileImage }}
                            style={styles.avatarImage}
                            contentFit="cover"
                            transition={200}
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <View style={styles.avatar}>
                            <Ionicons name="person" size={40} color="#fff" />
                        </View>
                    )}
                    <View style={styles.cameraIcon}>
                        <Ionicons name="camera" size={16} color="#fff" />
                    </View>
                </TouchableOpacity>

                <View style={styles.usernameContainer}>
                    <Text style={styles.username}>{name || "User"}</Text>
                    {isAdmin() && (
                        <View style={styles.adminBadge}>
                            <Ionicons name="shield-checkmark" size={14} color="#fff" />
                            <Text style={styles.adminBadgeText}>ADMIN</Text>
                        </View>
                    )}
                </View>
            </View>

            <View style={styles.formContainer}>
                <Text style={styles.sectionTitle}>기본 정보</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>이메일</Text>
                    <TextInput
                        style={[styles.input, styles.disabledInput]}
                        value={email}
                        editable={false}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>이름 <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="이름을 입력하세요"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>전화번호 <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="전화번호를 입력하세요"
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>나이대</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={ageGroup}
                                onValueChange={setAgeGroup}
                                style={styles.picker}
                            >
                                <Picker.Item label="선택" value="" />
                                <Picker.Item label="20대" value="20대" />
                                <Picker.Item label="30대" value="30대" />
                                <Picker.Item label="40대" value="40대" />
                                <Picker.Item label="50대" value="50대" />
                                <Picker.Item label="60대 이상" value="60대 이상" />
                            </Picker>
                        </View>
                    </View>

                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>성별</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={gender}
                                onValueChange={setGender}
                                style={styles.picker}
                            >
                                <Picker.Item label="선택" value="" />
                                <Picker.Item label="남성" value="남성" />
                                <Picker.Item label="여성" value="여성" />
                            </Picker>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>주소 정보</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>도시 <Text style={styles.required}>*</Text></Text>
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={selectedCity}
                            onValueChange={(value) => {
                                setSelectedCity(value);
                                setSelectedDistrict("");
                                setSelectedApartment("");
                            }}
                            style={styles.picker}
                        >
                            <Picker.Item label="도시 선택" value="" />
                            {CITIES.map((city) => (
                                <Picker.Item key={city} label={city} value={city} />
                            ))}
                        </Picker>
                    </View>
                </View>

                {selectedCity && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>구/군 <Text style={styles.required}>*</Text></Text>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={selectedDistrict}
                                onValueChange={(value) => {
                                    setSelectedDistrict(value);
                                    setSelectedApartment("");
                                }}
                                style={styles.picker}
                            >
                                <Picker.Item label="구/군 선택" value="" />
                                {districts.map((district) => (
                                    <Picker.Item key={district} label={district} value={district} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                )}

                {selectedDistrict && apartments.length > 0 && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>아파트</Text>
                        <View style={styles.pickerWrapper}>
                            <Picker
                                selectedValue={selectedApartment}
                                onValueChange={setSelectedApartment}
                                style={styles.picker}
                            >
                                <Picker.Item label="아파트 선택" value="" />
                                {apartments.map((apt) => (
                                    <Picker.Item key={apt} label={apt} value={apt} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                )}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>상세 주소</Text>
                    <TextInput
                        style={styles.input}
                        value={detailedAddress}
                        onChangeText={setDetailedAddress}
                        placeholder="동/호수 등 상세 주소"
                    />
                </View>

                <Text style={styles.sectionTitle}>거주 및 직업</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>거주 기간 <Text style={styles.required}>*</Text></Text>
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={residencePeriod}
                            onValueChange={setResidencePeriod}
                            style={styles.picker}
                        >
                            <Picker.Item label="선택해주세요" value="" />
                            <Picker.Item label="1년 미만" value="1년 미만" />
                            <Picker.Item label="1년 ~ 3년" value="1년 ~ 3년" />
                            <Picker.Item label="3년 ~ 5년" value="3년 ~ 5년" />
                            <Picker.Item label="5년 ~ 10년" value="5년 ~ 10년" />
                            <Picker.Item label="10년 이상" value="10년 이상" />
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>거주 목적 <Text style={styles.required}>*</Text></Text>
                    <View style={styles.pickerWrapper}>
                        <Picker
                            selectedValue={residencePurpose}
                            onValueChange={setResidencePurpose}
                            style={styles.picker}
                        >
                            <Picker.Item label="선택해주세요" value="" />
                            <Picker.Item label="사업/주재원" value="사업/주재원" />
                            <Picker.Item label="취업/직장" value="취업/직장" />
                            <Picker.Item label="학업/유학" value="학업/유학" />
                            <Picker.Item label="결혼/가족" value="결혼/가족" />
                            <Picker.Item label="은퇴/요양" value="은퇴/요양" />
                            <Picker.Item label="기타" value="기타" />
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>직업 <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={occupation}
                        onChangeText={setOccupation}
                        placeholder="직업을 입력하세요"
                    />
                </View>

                <Text style={styles.sectionTitle}>SNS 정보</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>카카오톡 ID</Text>
                    <TextInput
                        style={styles.input}
                        value={kakaoId}
                        onChangeText={setKakaoId}
                        placeholder="카카오톡 ID"
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Zalo ID</Text>
                    <TextInput
                        style={styles.input}
                        value={zaloId}
                        onChangeText={setZaloId}
                        placeholder="Zalo ID"
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Facebook</Text>
                    <TextInput
                        style={styles.input}
                        value={facebook}
                        onChangeText={setFacebook}
                        placeholder="Facebook 프로필 링크"
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Instagram</Text>
                    <TextInput
                        style={styles.input}
                        value={instagram}
                        onChangeText={setInstagram}
                        placeholder="Instagram 아이디"
                    />
                </View>

                <Text style={styles.sectionTitle}>관심사 (중복 선택 가능)</Text>
                <View style={styles.interestsContainer}>
                    {INTEREST_OPTIONS.map((interest) => (
                        <TouchableOpacity
                            key={interest}
                            style={[
                                styles.interestChip,
                                interests.includes(interest) && styles.interestChipSelected,
                            ]}
                            onPress={() => toggleInterest(interest)}
                        >
                            <Text
                                style={[
                                    styles.interestText,
                                    interests.includes(interest) && styles.interestTextSelected,
                                ]}
                            >
                                {interest}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={onCancel}
                    >
                        <Text style={styles.cancelButtonText}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.saveButton]}
                        onPress={onSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>저장</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                    <Text style={styles.deleteButtonText}>프로필 삭제</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    profileHeader: {
        alignItems: "center",
        padding: 24,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    avatarContainer: {
        position: "relative",
        marginBottom: 16,
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: "#ddd",
        justifyContent: "center",
        alignItems: "center",
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    cameraIcon: {
        position: "absolute",
        bottom: 0,
        right: 0,
        backgroundColor: "#FF6B35",
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: "#fff",
    },
    usernameContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    username: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
        marginRight: 8,
    },
    adminBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#FF6B35",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    adminBadgeText: {
        color: "#fff",
        fontSize: 10,
        fontWeight: "bold",
        marginLeft: 4,
    },
    formContainer: {
        padding: 20,
        paddingBottom: 50,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginTop: 20,
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    row: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    label: {
        fontSize: 14,
        color: "#666",
        marginBottom: 8,
    },
    required: {
        color: "#FF6B35",
    },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: "#333",
    },
    disabledInput: {
        backgroundColor: "#f5f5f5",
        color: "#999",
    },
    pickerWrapper: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        overflow: "hidden",
        justifyContent: "center",
    },
    picker: {
        height: 60,
    },
    interestsContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginBottom: 24,
    },
    interestChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#f5f5f5",
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: "#eee",
    },
    interestChipSelected: {
        backgroundColor: "#FFF0EB",
        borderColor: "#FF6B35",
    },
    interestText: {
        fontSize: 14,
        color: "#666",
    },
    interestTextSelected: {
        color: "#FF6B35",
        fontWeight: "600",
    },
    buttonContainer: {
        flexDirection: "row",
        marginTop: 24,
        marginBottom: 40,
    },
    button: {
        flex: 1,
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: "center",
    },
    cancelButton: {
        backgroundColor: "#f5f5f5",
        marginRight: 8,
    },
    saveButton: {
        backgroundColor: "#FF6B35",
        marginLeft: 8,
    },
    cancelButtonText: {
        fontSize: 16,
        color: "#666",
        fontWeight: "bold",
    },
    saveButtonText: {
        fontSize: 16,
        color: "#fff",
        fontWeight: "bold",
    },
    deleteButton: {
        alignItems: "center",
        padding: 16,
    },
    deleteButtonText: {
        color: "#999",
        textDecorationLine: "underline",
    },
});
