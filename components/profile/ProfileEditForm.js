import React from "react";
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    useColorScheme,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { useTranslation } from "react-i18next";
import { CITIES, INTEREST_OPTIONS } from "../../utils/constants";
import { getDistrictsByCity, getApartmentsByDistrict, translateCity, translateOther } from "../../utils/vietnamLocations";
import { getColors } from "../../utils/colors";

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
    const { t, i18n } = useTranslation('profile');
    const colorScheme = useColorScheme();
    const colors = getColors(colorScheme);
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
                <Text style={styles.sectionTitle}>{t('basicInfo')}</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('email')}</Text>
                    <TextInput
                        style={[styles.input, styles.disabledInput]}
                        value={email}
                        editable={false}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('name')} <Text style={styles.required}>{t('required')}</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder={t('namePlaceholder')}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('phone')} <Text style={styles.required}>{t('required')}</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder={t('phonePlaceholder')}
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>{t('ageGroup')}</Text>
                        <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                            <Picker
                                selectedValue={ageGroup}
                                onValueChange={setAgeGroup}
                                style={[styles.picker, { color: colors.text }]}
                                dropdownIconColor={colors.textSecondary}
                            >
                                <Picker.Item label={t('select')} value="" color={colors.text} />
                                <Picker.Item label={t('age20s')} value="20대" color={colors.text} />
                                <Picker.Item label={t('age30s')} value="30대" color={colors.text} />
                                <Picker.Item label={t('age40s')} value="40대" color={colors.text} />
                                <Picker.Item label={t('age50s')} value="50대" color={colors.text} />
                                <Picker.Item label={t('age60plus')} value="60대 이상" color={colors.text} />
                            </Picker>
                        </View>
                    </View>

                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>{t('gender')}</Text>
                        <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                            <Picker
                                selectedValue={gender}
                                onValueChange={setGender}
                                style={[styles.picker, { color: colors.text }]}
                                dropdownIconColor={colors.textSecondary}
                            >
                                <Picker.Item label={t('select')} value="" color={colors.text} />
                                <Picker.Item label={t('male')} value="남성" color={colors.text} />
                                <Picker.Item label={t('female')} value="여성" color={colors.text} />
                            </Picker>
                        </View>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>{t('addressInfo')}</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('city')} <Text style={styles.required}>{t('required')}</Text></Text>
                    <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                        <Picker
                            selectedValue={selectedCity}
                            onValueChange={(value) => {
                                setSelectedCity(value);
                                setSelectedDistrict("");
                                setSelectedApartment("");
                            }}
                            style={[styles.picker, { color: colors.text }]}
                            dropdownIconColor={colors.textSecondary}
                        >
                            <Picker.Item label={t('selectCity')} value="" color={colors.text} />
                            {CITIES.map((city) => (
                                <Picker.Item key={city} label={translateCity(city, i18n.language)} value={city} color={colors.text} />
                            ))}
                        </Picker>
                    </View>
                </View>

                {selectedCity && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('district')} <Text style={styles.required}>{t('required')}</Text></Text>
                        <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                            <Picker
                                selectedValue={selectedDistrict}
                                onValueChange={(value) => {
                                    setSelectedDistrict(value);
                                    setSelectedApartment("");
                                }}
                                style={[styles.picker, { color: colors.text }]}
                                dropdownIconColor={colors.textSecondary}
                            >
                                <Picker.Item label={t('selectDistrict')} value="" color={colors.text} />
                                {districts.map((district) => (
                                    <Picker.Item key={district} label={translateOther(district, i18n.language)} value={district} color={colors.text} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                )}

                {selectedDistrict && apartments.length > 0 && (
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>{t('apartment')}</Text>
                        <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                            <Picker
                                selectedValue={selectedApartment}
                                onValueChange={setSelectedApartment}
                                style={[styles.picker, { color: colors.text }]}
                                dropdownIconColor={colors.textSecondary}
                            >
                                <Picker.Item label={t('selectApartment')} value="" color={colors.text} />
                                {apartments.map((apt) => (
                                    <Picker.Item key={apt} label={translateOther(apt, i18n.language)} value={apt} color={colors.text} />
                                ))}
                            </Picker>
                        </View>
                    </View>
                )}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('detailedAddress')}</Text>
                    <TextInput
                        style={styles.input}
                        value={detailedAddress}
                        onChangeText={setDetailedAddress}
                        placeholder={t('detailedAddressPlaceholder')}
                    />
                </View>

                <Text style={styles.sectionTitle}>{t('residenceJob')}</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('residencePeriod')} <Text style={styles.required}>{t('required')}</Text></Text>
                    <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                        <Picker
                            selectedValue={residencePeriod}
                            onValueChange={setResidencePeriod}
                            style={[styles.picker, { color: colors.text }]}
                            dropdownIconColor={colors.textSecondary}
                        >
                            <Picker.Item label={t('pleaseSelect')} value="" color={colors.text} />
                            <Picker.Item label={t('lessThan1Year')} value="1년 미만" color={colors.text} />
                            <Picker.Item label={t('oneToThreeYears')} value="1년 ~ 3년" color={colors.text} />
                            <Picker.Item label={t('threeToFiveYears')} value="3년 ~ 5년" color={colors.text} />
                            <Picker.Item label={t('fiveToTenYears')} value="5년 ~ 10년" color={colors.text} />
                            <Picker.Item label={t('moreThan10Years')} value="10년 이상" color={colors.text} />
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('residencePurpose')} <Text style={styles.required}>{t('required')}</Text></Text>
                    <View style={[styles.pickerWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                        <Picker
                            selectedValue={residencePurpose}
                            onValueChange={setResidencePurpose}
                            style={[styles.picker, { color: colors.text }]}
                            dropdownIconColor={colors.textSecondary}
                        >
                            <Picker.Item label={t('pleaseSelect')} value="" color={colors.text} />
                            <Picker.Item label={t('business')} value="사업/주재원" color={colors.text} />
                            <Picker.Item label={t('employment')} value="취업/직장" color={colors.text} />
                            <Picker.Item label={t('study')} value="학업/유학" color={colors.text} />
                            <Picker.Item label={t('family')} value="결혼/가족" color={colors.text} />
                            <Picker.Item label={t('retirement')} value="은퇴/요양" color={colors.text} />
                            <Picker.Item label={t('other')} value="기타" color={colors.text} />
                        </Picker>
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('occupation')} <Text style={styles.required}>{t('required')}</Text></Text>
                    <TextInput
                        style={styles.input}
                        value={occupation}
                        onChangeText={setOccupation}
                        placeholder={t('occupationPlaceholder')}
                    />
                </View>

                <Text style={styles.sectionTitle}>{t('snsInfo')}</Text>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('kakaoId')}</Text>
                    <TextInput
                        style={styles.input}
                        value={kakaoId}
                        onChangeText={setKakaoId}
                        placeholder={t('kakaoIdPlaceholder')}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('zaloId')}</Text>
                    <TextInput
                        style={styles.input}
                        value={zaloId}
                        onChangeText={setZaloId}
                        placeholder={t('zaloIdPlaceholder')}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('facebook')}</Text>
                    <TextInput
                        style={styles.input}
                        value={facebook}
                        onChangeText={setFacebook}
                        placeholder={t('facebookPlaceholder')}
                    />
                </View>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>{t('instagram')}</Text>
                    <TextInput
                        style={styles.input}
                        value={instagram}
                        onChangeText={setInstagram}
                        placeholder={t('instagramPlaceholder')}
                    />
                </View>

                <Text style={styles.sectionTitle}>{t('interests')}</Text>
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
                        <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.button, styles.saveButton]}
                        onPress={onSave}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.saveButtonText}>{t('save')}</Text>
                        )}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
                    <Text style={styles.deleteButtonText}>{t('deleteProfile')}</Text>
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
