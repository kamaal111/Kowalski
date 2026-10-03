#if os(macOS)
    import AppKit
    import SwiftUI

    struct KowalskiAuthSettingsWindow: NSViewRepresentable {
        let isAuthorized: Bool

        func makeNSView(context _: Context) -> KowalskiAuthSettingsWindowView {
            let view = KowalskiAuthSettingsWindowView()
            view.isAuthorized = isAuthorized
            return view
        }

        func updateNSView(_ view: KowalskiAuthSettingsWindowView, context _: Context) {
            view.isAuthorized = isAuthorized
        }
    }

    final class KowalskiAuthSettingsWindowView: NSView {
        private(set) var windowTask: Task<Void, Never>?

        var isAuthorized = false {
            didSet { scheduleAuthorizationCheck() }
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            scheduleAuthorizationCheck()
        }

        private func scheduleAuthorizationCheck() {
            windowTask?.cancel()
            windowTask = Task { @MainActor [weak self] in
                await Task.yield()
                guard !Task.isCancelled else { return }
                self?.closeIfUnauthorized()
            }
        }

        private func closeIfUnauthorized() {
            guard !isAuthorized else { return }
            unsafe window?.close()
        }
    }
#endif
