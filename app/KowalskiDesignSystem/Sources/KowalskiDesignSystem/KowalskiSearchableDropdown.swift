//
//  KowalskiSearchableDropdown.swift
//  KowalskiDesignSystem
//
//  Created by Kamaal M Farah on 11/17/25.
//

import KamaalUI
import SwiftUI

private let debounceTimeInMilliseconds: UInt64 = 1000

public struct KowalskiSearchableDropdown<Item: Identifiable & Hashable>: View {
    @State private var searchText = ""
    @State private var searchResults: [Item] = []
    @State private var isSearching = false
    @State private var searchError: String?
    @State private var searchTask: Task<Void, Never>?
    @State private var showDropdown = false
    @State private var textYOffset: CGFloat
    @State private var textScaleEffect: CGFloat

    @FocusState private var isFocused: Bool

    @Binding private var selectedItem: Item?

    private let title: String
    private let itemLabel: (Item) -> String
    private let onSearch: (String) async -> Result<[Item], Error>

    public init(
        selectedItem: Binding<Item?>,
        title: String,
        itemLabel: @escaping (Item) -> String,
        onSearch: @escaping (String) async -> Result<[Item], Error>,
    ) {
        _selectedItem = selectedItem
        self.title = title
        self.itemLabel = itemLabel
        self.onSearch = onSearch
        textYOffset = Self.nextTextYOffsetValue(selectedItem.wrappedValue == nil)
        textScaleEffect = Self.nextTextScaleEffectValue(selectedItem.wrappedValue == nil)
    }

    public init(
        selectedItem: Binding<Item?>,
        localizedTitle: LocalizedStringResource,
        bundle: Bundle? = nil,
        itemLabel: @escaping (Item) -> String,
        onSearch: @escaping (String) async -> Result<[Item], Error>,
    ) {
        let title = if let bundle {
            NSLocalizedString(localizedTitle.key, bundle: bundle, comment: "")
        } else {
            NSLocalizedString(localizedTitle.key, comment: "")
        }
        self.init(
            selectedItem: selectedItem,
            title: title,
            itemLabel: itemLabel,
            onSearch: onSearch,
        )
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .leading) {
                HStack {
                    if let selectedItem {
                        Text(itemLabel(selectedItem))
                            .ktakeWidthEagerly(alignment: .leading)
                        Button(action: handleClearSelection) {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                    } else {
                        TextField(placeholderText, text: $searchText)
                            .focused($isFocused)
                            .textFieldStyle(.plain)
                    }
                }
            }
            .padding(.top, 12)
            .animation(.spring(response: 0.5), value: textYOffset)

            if showDropdown, isFocused {
                VStack(alignment: .leading, spacing: 0) {
                    if isSearching {
                        HStack {
                            ProgressView()
                                .controlSize(.small)
                            Text("Searching...")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(KowalskiSizes.small.rawValue)
                    } else if let searchError {
                        HStack {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundColor(.orange)
                            Text(searchError)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(KowalskiSizes.small.rawValue)
                    } else if searchResults.isEmpty, !searchText.isEmpty {
                        HStack {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.secondary)
                            Text("No results found")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(KowalskiSizes.small.rawValue)
                    } else {
                        ScrollView {
                            VStack(alignment: .leading, spacing: 0) {
                                ForEach(searchResults) { item in
                                    Button(action: { handleSelectItem(item) }) {
                                        Text(itemLabel(item))
                                            .font(.body)
                                            .foregroundColor(.primary)
                                            .padding(.vertical, 8)
                                            .padding(.horizontal, KowalskiSizes.small.rawValue)
                                            .ktakeWidthEagerly(alignment: .leading)
                                    }
                                    .buttonStyle(.plain)
                                    .background(Color.clear)
                                }
                            }
                        }
                        .frame(maxHeight: 200)
                    }
                }
                .background(dropdownBackgroundColor)
                .cornerRadius(8)
                .shadow(radius: 4)
                .padding(.top, 4)
            }
        }
        .onChange(of: searchText, handleSearchTextChange)
        .onChange(of: isFocused, handleFocusChange)
        .onChange(of: selectedItem, handleSelectedItemChange)
    }

    private var placeholderText: String {
        #if canImport(UIKit)
            return ""
        #else
            return title
        #endif
    }

    private var textColor: Color {
        if selectedItem == nil, searchText.isEmpty {
            .secondary
        } else {
            .accentColor
        }
    }

    private var titleHorizontalPadding: CGFloat {
        if selectedItem == nil, searchText.isEmpty { 4 } else { 0 }
    }

    private var dropdownBackgroundColor: Color {
        #if os(macOS)
            Color(nsColor: .controlBackgroundColor)
        #else
            Color(uiColor: .systemBackground)
        #endif
    }

    private func handleSearchTextChange(_: String, _ newValue: String) {
        guard !newValue.isEmpty else {
            searchResults = []
            showDropdown = false
            searchError = nil
            searchTask?.cancel()
            return
        }

        searchTask?.cancel()
        searchError = nil

        let task = Task {
            do {
                try await Task.sleep(nanoseconds: debounceTimeInMilliseconds * 1_000_000)
            } catch {
                return
            }

            guard !Task.isCancelled else { return }

            await performSearch(query: newValue)
        }

        searchTask = task
    }

    private func handleFocusChange(_: Bool, _ newValue: Bool) {
        if !newValue {
            showDropdown = false
            if selectedItem == nil {
                searchText = ""
                searchResults = []
            }
        }
    }

    private func handleSelectedItemChange(_: Item?, _ newValue: Item?) {
        let isEmpty = newValue == nil
        textYOffset = Self.nextTextYOffsetValue(isEmpty && searchText.isEmpty)
        textScaleEffect = Self.nextTextScaleEffectValue(isEmpty && searchText.isEmpty)
    }

    private func handleClearSelection() {
        selectedItem = nil
        searchText = ""
        searchResults = []
        showDropdown = false
        isFocused = true
    }

    private func handleSelectItem(_ item: Item) {
        selectedItem = item
        searchText = ""
        searchResults = []
        showDropdown = false
        isFocused = false
    }

    @MainActor
    private func performSearch(query: String) async {
        isSearching = true
        showDropdown = true

        let result = await onSearch(query)

        isSearching = false

        switch result {
        case let .success(items):
            searchResults = items
            searchError = nil
        case let .failure(error):
            searchResults = []
            searchError = error.localizedDescription
        }
    }

    private static func nextTextYOffsetValue(_ isEmpty: Bool) -> CGFloat {
        if isEmpty { 0 } else { -25 }
    }

    private static func nextTextScaleEffectValue(_ isEmpty: Bool) -> CGFloat {
        if isEmpty { 1 } else { 0.75 }
    }
}

private struct PreviewItem: Identifiable, Hashable {
    let id: String
    let name: String
}

#Preview {
    @Previewable @State var selectedItem: PreviewItem?

    VStack {
        KowalskiSearchableDropdown(
            selectedItem: $selectedItem,
            title: "Select Item",
            itemLabel: { $0.name },
            onSearch: { query in
                try? await Task.sleep(nanoseconds: 500_000_000)
                let items = [
                    PreviewItem(id: "1", name: "AAPL - Apple Inc."),
                    PreviewItem(id: "2", name: "GOOGL - Alphabet Inc."),
                    PreviewItem(id: "3", name: "MSFT - Microsoft Corporation"),
                ].filter { $0.name.localizedCaseInsensitiveContains(query) }
                return .success(items)
            },
        )
        .padding(.all, .medium)

        if let selectedItem {
            Text("Selected: \(selectedItem.name)")
                .padding(.all, .medium)
        }
    }
}
