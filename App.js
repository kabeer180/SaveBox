
import { useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  Linking,
  Image,
} from 'react-native';

const STORAGE_KEY = 'savebox-items';
const THEME_KEY = 'savebox-theme';
const EMPTY_FORM = {
  type: 'note',
  title: '',
  content: '',
  url: '',
  tags: '',
  imageUri: '',
};

const themePalette = {
  light: {
    background: '#F4F1FF',
    panel: '#FFFFFF',
    panelAlt: '#F7F4FF',
    border: '#E3DAFF',
    borderStrong: '#D8CDF9',
    text: '#2B1B4A',
    textMuted: '#675F7D',
    accent: '#5C44D6',
    accentSoft: '#EAE5FF',
    accentSoftText: '#4C3AB3',
    success: '#4C3AB3',
    danger: '#B91C1C',
    dangerSoft: '#FEE2E2',
    tag: '#EFE9FF',
    tagText: '#4C3AB3',
    shadow: '#5C44D6',
    link: '#2E6BFF',
  },
  dark: {
    background: '#120F1E',
    panel: '#171526',
    panelAlt: '#1F1B2D',
    border: '#322B49',
    borderStrong: '#473A68',
    text: '#F3F1FF',
    textMuted: '#B5AFCC',
    accent: '#8B7AF8',
    accentSoft: '#201C38',
    accentSoftText: '#DCD6FF',
    success: '#A79BF8',
    danger: '#FF8A8A',
    dangerSoft: '#3A2124',
    tag: '#221D36',
    tagText: '#DCD6FF',
    shadow: '#000000',
    link: '#8DB4FF',
  },
};

function formatDate(value) {
  if (!value) {
    return '—';
  }

  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return '—';
  }
}

function normalizeItem(rawItem) {
  const type = rawItem?.type === 'link' ? 'link' : 'note';

  return {
    id: String(rawItem?.id ?? Date.now()),
    type,
    title: String(rawItem?.title ?? '').trim(),
    content: String(rawItem?.content ?? '').trim(),
    url: String(rawItem?.url ?? '').trim(),
    tags: Array.isArray(rawItem?.tags) ? rawItem.tags : [],
    imageUri: rawItem?.imageUri ?? '',
    archived: Boolean(rawItem?.archived),
    createdAt: rawItem?.createdAt ?? new Date().toISOString(),
    updatedAt: rawItem?.updatedAt ?? rawItem?.createdAt ?? new Date().toISOString(),
  };
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterMode, setFilterMode] = useState('active');
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    async function loadTheme() {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_KEY);
        if (savedTheme === 'dark' || savedTheme === 'light') {
          setTheme(savedTheme);
        }
      } catch (error) {
        console.log('Error loading theme:', error);
      }
    }

    loadTheme();
  }, []);

  useEffect(() => {
    async function loadItems() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setItems(parsed.map(normalizeItem));
          }
        }
      } catch (error) {
        console.log('Error loading items:', error);
        setMessage('Could not load your saved items.');
      }
    }

    loadItems();
  }, []);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;

  const filteredItems = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return items.filter((item) => {
      const matchesFilter =
        filterMode === 'all' ||
        (filterMode === 'active' && !item.archived) ||
        (filterMode === 'archived' && item.archived);

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        item.title,
        item.content,
        item.url,
        item.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [items, searchText, filterMode]);

  async function persistItems(nextItems) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
    setItems(nextItems);
  }

  async function toggleTheme() {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    try {
      await AsyncStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {
      console.log('Error saving theme:', error);
    }
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setIsEditing(false);
  }

  function openCreateScreen() {
    resetForm();
    setScreen('editor');
  }

  function openEditScreen(item) {
    setSelectedId(item.id);
    setForm({
      type: item.type || 'note',
      title: item.title || '',
      content: item.content || '',
      url: item.url || '',
      tags: (item.tags || []).join(', '),
      imageUri: item.imageUri || '',
    });
    setIsEditing(true);
    setScreen('editor');
  }

  async function saveItem() {
    const title = form.title.trim();
    const type = form.type === 'link' ? 'link' : 'note';
    const content = form.content.trim();
    const url = form.url.trim();

    if (!title) {
      setMessage('Please enter a title.');
      return;
    }

    if (type === 'link') {
      if (!url || !/^https?:\/\/.+\..+$/i.test(url)) {
        setMessage('Please enter a valid link starting with https:// or http://.');
        return;
      }
    } else if (!content && !form.imageUri) {
      setMessage('Please add note text or an image.');
      return;
    }

    const now = new Date().toISOString();
    const tags = form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const nextItems = isEditing
      ? items.map((item) =>
          item.id === selectedId
            ? {
                ...item,
                type,
                title,
                content,
                url: type === 'link' ? url : '',
                tags,
                imageUri: form.imageUri || item.imageUri || '',
                updatedAt: now,
              }
            : item,
        )
      : [
          ...items,
          {
            id: String(Date.now()),
            type,
            title,
            content,
            url: type === 'link' ? url : '',
            tags,
            imageUri: form.imageUri || '',
            archived: false,
            createdAt: now,
            updatedAt: now,
          },
        ];

    try {
      await persistItems(nextItems.map(normalizeItem));
      resetForm();
      setScreen('home');
      setMessage(isEditing ? 'Item updated successfully!' : 'Item saved successfully!');
    } catch (error) {
      console.log('Error saving item:', error);
      setMessage('Could not save the item. Please try again.');
    }
  }

  async function deleteItem(itemId) {
    const updatedItems = items.filter((item) => item.id !== itemId);

    try {
      await persistItems(updatedItems);
      if (selectedId === itemId) {
        setSelectedId(null);
      }
      setScreen('home');
      setMessage('Item deleted successfully!');
    } catch (error) {
      console.log('Error deleting item:', error);
      setMessage('Could not delete the item.');
    }
  }

  async function toggleArchive(itemId) {
    const found = items.find((item) => item.id === itemId);
    if (!found) {
      return;
    }

    const updatedItems = items.map((item) =>
      item.id === itemId ? { ...item, archived: !Boolean(item.archived), updatedAt: new Date().toISOString() } : item,
    );

    try {
      await persistItems(updatedItems);
      setMessage(found.archived ? 'Item restored successfully!' : 'Item archived successfully!');
    } catch (error) {
      console.log('Error updating archive status:', error);
      setMessage('Could not update archive status.');
    }
  }

  async function pickImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setMessage('Permission is required to choose a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setForm((current) => ({ ...current, imageUri: result.assets[0].uri }));
        setMessage('Image selected successfully!');
      }
    } catch (error) {
      console.log('Image picker error:', error);
      setMessage('Could not open the photo library.');
    }
  }

  async function openLink(url) {
    if (!url) {
      setMessage('No link available.');
      return;
    }

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        setMessage('This link cannot be opened on this device.');
      }
    } catch (error) {
      console.log('Link error:', error);
      setMessage('Could not open this link.');
    }
  }

  const palette = themePalette[theme];

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: palette.background,
    },
    screenWrap: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 52,
      paddingBottom: 24,
      backgroundColor: palette.background,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    heading: {
      fontSize: 34,
      fontWeight: '800',
      color: palette.text,
      flex: 1,
      letterSpacing: -0.8,
    },
    textArea: {
      minHeight: 130,
      textAlignVertical: 'top',
    },
    input: {
      backgroundColor: palette.panel,
      borderWidth: 1,
      borderColor: palette.border,
      color: palette.text,
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      fontSize: 16,
      shadowColor: palette.shadow,
      shadowOpacity: theme === 'dark' ? 0.18 : 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 14,
    },
    filterButton: {
      flex: 1,
      backgroundColor: palette.panel,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: palette.border,
      paddingVertical: 10,
      alignItems: 'center',
      shadowColor: palette.shadow,
      shadowOpacity: theme === 'dark' ? 0.16 : 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    filterButtonText: {
      fontWeight: '600',
      color: palette.accentSoftText,
    },
    filterButtonTextSelected: {
      color: '#fff',
    },
    filterButtonSelected: {
      backgroundColor: palette.accent,
      borderColor: palette.accent,
      shadowColor: palette.accent,
      shadowOpacity: theme === 'dark' ? 0.22 : 0.18,
    },
    message: {
      color: palette.accentSoftText,
      fontSize: 14,
      marginBottom: 10,
    },
    listContainer: {
      flex: 1,
      paddingBottom: 8,
    },
    card: {
      backgroundColor: palette.panel,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 14,
      marginBottom: 12,
      shadowColor: palette.shadow,
      shadowOpacity: theme === 'dark' ? 0.22 : 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    detailCard: {
      backgroundColor: palette.panel,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: palette.border,
      padding: 16,
      shadowColor: palette.shadow,
      shadowOpacity: theme === 'dark' ? 0.24 : 0.09,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
    },
    cardType: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      color: palette.accent,
      marginBottom: 6,
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 8,
      marginBottom: 8,
      gap: 6,
    },
    cardTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: palette.text,
      marginBottom: 8,
      letterSpacing: -0.4,
    },
    cardContent: {
      fontSize: 16,
      color: palette.textMuted,
      lineHeight: 22,
      marginTop: 8,
    },
    linkText: {
      color: palette.link,
      marginTop: 8,
      textDecorationLine: 'underline',
    },
    tagChip: {
      backgroundColor: palette.tag,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    tagText: {
      color: palette.tagText,
      fontSize: 12,
      fontWeight: '600',
    },
    metaText: {
      color: palette.textMuted,
      fontSize: 12,
      marginTop: 8,
    },
    cardActions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    imageButton: {
      backgroundColor: palette.accentSoft,
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: palette.border,
      shadowColor: palette.shadow,
      shadowOpacity: theme === 'dark' ? 0.16 : 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    imageButtonText: {
      color: palette.accentSoftText,
      fontWeight: '700',
    },
    emptyMessage: {
      color: palette.textMuted,
      fontSize: 15,
      textAlign: 'center',
      marginTop: 30,
      paddingVertical: 18,
      paddingHorizontal: 12,
      backgroundColor: palette.panelAlt,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: palette.border,
    },
    primaryButton: {
      backgroundColor: palette.accent,
      paddingVertical: 11,
      paddingHorizontal: 16,
      borderRadius: 12,
      shadowColor: palette.accent,
      shadowOpacity: theme === 'dark' ? 0.32 : 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 7 },
      elevation: 4,
    },
    primaryButtonText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    secondaryButton: {
      backgroundColor: palette.accentSoft,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      shadowColor: palette.shadow,
      shadowOpacity: theme === 'dark' ? 0.14 : 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    secondaryButtonText: {
      color: palette.accentSoftText,
      fontWeight: '700',
    },
    dangerButton: {
      backgroundColor: palette.dangerSoft,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      shadowColor: palette.danger,
      shadowOpacity: theme === 'dark' ? 0.14 : 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    dangerButtonText: {
      color: palette.danger,
      fontWeight: '700',
    },
    backButton: {
      paddingVertical: 8,
      paddingRight: 12,
    },
    backButtonText: {
      color: palette.accentSoftText,
      fontWeight: '700',
      fontSize: 16,
    },
    editorActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 18,
      gap: 10,
    },
    editorImage: {
      width: '100%',
      height: 180,
      borderRadius: 12,
      marginBottom: 16,
    },
    cardImage: {
      width: '100%',
      height: 180,
      borderRadius: 12,
      marginBottom: 12,
    },
    detailImage: {
      width: '100%',
      height: 220,
      borderRadius: 12,
      marginBottom: 12,
    },
  });

  const styles = dynamicStyles;

  function renderHome() {
    return (
      <View style={styles.screenWrap}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Inbox</Text>
          <Pressable style={styles.primaryButton} onPress={openCreateScreen}>
            <Text style={styles.primaryButtonText}>+ New</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            placeholder="Search..."
            placeholderTextColor={palette.textMuted}
            value={searchText}
            onChangeText={setSearchText}
          />
          <Pressable
            onPress={toggleTheme}
            style={{
              marginLeft: 10,
              backgroundColor: palette.panel,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: palette.border,
              paddingHorizontal: 12,
              paddingVertical: 12,
              shadowColor: palette.shadow,
              shadowOpacity: theme === 'dark' ? 0.2 : 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ color: palette.text, fontWeight: '700' }}>{theme === 'light' ? '☾' : '☀'}</Text>
          </Pressable>
        </View>

        <View style={styles.filterRow}>
          {['active', 'archived', 'all'].map((mode) => (
            <Pressable
              key={mode}
              style={[styles.filterButton, filterMode === mode && styles.filterButtonSelected]}
              onPress={() => setFilterMode(mode)}
            >
              <Text style={[styles.filterButtonText, filterMode === mode && styles.filterButtonTextSelected]}>
                {mode === 'active' ? 'Active' : mode === 'archived' ? 'Archived' : 'All'}
              </Text>
            </Pressable>
          ))}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filteredItems.length === 0 ? (
            <Text style={styles.emptyMessage}>
              {items.length === 0 ? 'Your inbox is empty. Save your first idea.' : 'No matching items found.'}
            </Text>
          ) : (
            filteredItems.map((item) => (
              <View key={item.id} style={styles.card}>
                {item.imageUri ? (
                  <Image source={{ uri: item.imageUri }} style={styles.cardImage} resizeMode="cover" />
                ) : null}

                <Text style={styles.cardType}>{item.type === 'link' ? '🔗 LINK' : '📝 NOTE'}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>

                {item.tags && item.tags.length > 0 ? (
                  <View style={styles.tagRow}>
                    {item.tags.map((tag, index) => (
                      <View key={`${item.id}-${tag}-${index}`} style={styles.tagChip}>
                        <Text style={styles.tagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {item.type === 'link' && item.url ? (
                  <Pressable onPress={() => openLink(item.url)}>
                    <Text style={styles.linkText}>{item.url}</Text>
                  </Pressable>
                ) : item.content ? (
                  <Text style={styles.cardContent}>{item.content}</Text>
                ) : null}

                <Text style={styles.metaText}>Updated: {formatDate(item.updatedAt)}</Text>

                <View style={styles.cardActions}>
                  <Pressable style={styles.secondaryButton} onPress={() => { setSelectedId(item.id); setScreen('detail'); }}>
                    <Text style={styles.secondaryButtonText}>View</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => openEditScreen(item)}>
                    <Text style={styles.secondaryButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButton} onPress={() => toggleArchive(item.id)}>
                    <Text style={styles.secondaryButtonText}>{item.archived ? 'Restore' : 'Archive'}</Text>
                  </Pressable>
                  <Pressable style={styles.dangerButton} onPress={() => deleteItem(item.id)}>
                    <Text style={styles.dangerButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    );
  }

  function renderEditor() {
    return (
      <View style={styles.screenWrap}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => { resetForm(); setScreen('home'); }}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.heading}>{isEditing ? 'Edit item' : 'Create item'}</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Title"
          value={form.title}
          onChangeText={(value) => setForm((current) => ({ ...current, title: value }))}
        />

        <View style={styles.filterRow}>
          {['note', 'link'].map((type) => (
            <Pressable
              key={type}
              style={[styles.filterButton, form.type === type && styles.filterButtonSelected]}
              onPress={() => setForm((current) => ({ ...current, type }))}
            >
              <Text style={[styles.filterButtonText, form.type === type && styles.filterButtonTextSelected]}>
                {type === 'note' ? 'Notes' : 'Links'}
              </Text>
            </Pressable>
          ))}
        </View>

        {form.type === 'link' ? (
          <TextInput
            style={styles.input}
            placeholder="Paste a full URL (https://example.com)"
            value={form.url}
            onChangeText={(value) => setForm((current) => ({ ...current, url: value }))}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
          />
        ) : (
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Write your note here"
            value={form.content}
            onChangeText={(value) => setForm((current) => ({ ...current, content: value }))}
            multiline
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Tags (comma separated, e.g. ideas, work, travel)"
          value={form.tags}
          onChangeText={(value) => setForm((current) => ({ ...current, tags: value }))}
          autoCapitalize="none"
        />

        <Pressable style={styles.imageButton} onPress={pickImage}>
          <Text style={styles.imageButtonText}>{form.imageUri ? 'Change image' : 'Add image'}</Text>
        </Pressable>

        {form.imageUri ? (
          <Image source={{ uri: form.imageUri }} style={styles.editorImage} resizeMode="cover" />
        ) : null}

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.editorActions}>
          <Pressable style={styles.secondaryButton} onPress={() => { resetForm(); setScreen('home'); }}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={saveItem}>
            <Text style={styles.primaryButtonText}>{isEditing ? 'Update item' : 'Save item'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderDetail() {
    if (!selectedItem) {
      return (
        <View style={styles.screenWrap}>
          <Text style={styles.emptyMessage}>No item selected.</Text>
          <Pressable style={styles.primaryButton} onPress={() => setScreen('home')}>
            <Text style={styles.primaryButtonText}>Back to inbox</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.screenWrap}>
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => setScreen('home')}>
            <Text style={styles.backButtonText}>← Back</Text>
          </Pressable>
          <Text style={styles.heading}>Details</Text>
        </View>

        <View style={styles.detailCard}>
          {selectedItem.imageUri ? (
            <Image source={{ uri: selectedItem.imageUri }} style={styles.detailImage} resizeMode="cover" />
          ) : null}

          <Text style={styles.cardType}>{selectedItem.type === 'link' ? '🔗 LINK' : '📝 NOTE'}</Text>
          <Text style={styles.cardTitle}>{selectedItem.title}</Text>

          {selectedItem.tags && selectedItem.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {selectedItem.tags.map((tag, index) => (
                <View key={`${selectedItem.id}-detail-${index}`} style={styles.tagChip}>
                  <Text style={styles.tagText}>#{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {selectedItem.type === 'link' ? (
            <Pressable onPress={() => openLink(selectedItem.url)}>
              <Text style={styles.linkText}>{selectedItem.url}</Text>
            </Pressable>
          ) : (
            <Text style={styles.cardContent}>{selectedItem.content || 'No note text saved.'}</Text>
          )}

          <Text style={styles.metaText}>Created: {formatDate(selectedItem.createdAt)}</Text>
          <Text style={styles.metaText}>Updated: {formatDate(selectedItem.updatedAt)}</Text>
          <Text style={styles.metaText}>Status: {selectedItem.archived ? 'Archived' : 'Active'}</Text>

          <View style={styles.cardActions}>
            {selectedItem.type === 'link' && selectedItem.url ? (
              <Pressable style={styles.secondaryButton} onPress={() => openLink(selectedItem.url)}>
                <Text style={styles.secondaryButtonText}>Open link</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryButton} onPress={() => openEditScreen(selectedItem)}>
              <Text style={styles.secondaryButtonText}>Edit</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => toggleArchive(selectedItem.id)}>
              <Text style={styles.secondaryButtonText}>{selectedItem.archived ? 'Restore' : 'Archive'}</Text>
            </Pressable>
            <Pressable style={styles.dangerButton} onPress={() => deleteItem(selectedItem.id)}>
              <Text style={styles.dangerButtonText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (screen === 'editor') {
    return (
      <View style={styles.container}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        {renderEditor()}
      </View>
    );
  }

  if (screen === 'detail') {
    return (
      <View style={styles.container}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        {renderDetail()}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {renderHome()}
    </View>
  );
}

