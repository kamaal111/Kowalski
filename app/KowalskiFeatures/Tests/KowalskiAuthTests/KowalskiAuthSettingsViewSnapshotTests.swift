//
//  KowalskiAuthSettingsViewSnapshotTests.swift
//  KowalskiFeatures
//

#if os(macOS)
    import AppKit
    @testable import KowalskiAuth
    @testable import KowalskiClient
    import SnapshotTesting
    import SwiftUI
    import Testing

    @MainActor
    @Suite("Auth Settings View Snapshot Tests", .serialized)
    struct KowalskiAuthSettingsViewSnapshotTests {
        @Test
        func `Renders preferred currency and sign out when authenticated`() async throws {
            let auth = KowalskiAuth.testing(client: .preview(withCredentials: false))
            try await auth.kamaalAuth.signIn(email: "test@example.com", password: "password123").get()

            #expect(auth.isLoggedIn)
            SettingsSnapshot.assert(auth: auth, testName: #function)
        }

        @Test
        func `Hides authenticated settings when signed out`() {
            let auth = KowalskiAuth.testing(client: .preview(withCredentials: false))

            #expect(!auth.isLoggedIn)
            SettingsSnapshot.assert(auth: auth, testName: #function)
        }
    }

    @MainActor
    private enum SettingsSnapshot {
        static func assert(auth: KowalskiAuth, testName: String) {
            for scheme in [ColorScheme.light, .dark] {
                let view = SettingsHostingView(
                    rootView: KowalskiAuthSettingsView()
                        .environment(auth)
                        .environment(\.locale, Locale(identifier: "en_US"))
                        .preferredColorScheme(scheme)
                        .tint(.blue),
                )
                view.appearance = NSAppearance(named: scheme == .dark ? .darkAqua : .aqua)
                view.frame = NSRect(x: 0, y: 0, width: 500, height: 400)
                view.wantsLayer = true
                view.layer?.backgroundColor = (scheme == .dark ? NSColor.black : NSColor.white).cgColor
                let osVersion = ProcessInfo.processInfo.operatingSystemVersion.majorVersion
                assertSnapshot(of: view, as: .image, named: "macOS-\(osVersion)-\(scheme)", testName: testName)
            }
        }
    }

    private final class SettingsHostingView<Content: View>: NSHostingView<Content> {
        override func bitmapImageRepForCachingDisplay(in rect: NSRect) -> NSBitmapImageRep? {
            let bitmap = unsafe NSBitmapImageRep(
                bitmapDataPlanes: nil, pixelsWide: Int(rect.width * 2), pixelsHigh: Int(rect.height * 2),
                bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
                colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0,
            )
            bitmap?.size = rect.size
            return bitmap
        }
    }
#endif
