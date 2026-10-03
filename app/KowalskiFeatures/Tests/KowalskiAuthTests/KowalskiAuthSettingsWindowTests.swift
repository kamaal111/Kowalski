#if os(macOS)
    import AppKit
    @testable import KowalskiAuth
    import Testing

    @MainActor
    @Suite("Auth Settings Window Tests", .serialized)
    struct KowalskiAuthSettingsWindowTests {
        @Test
        func `Authorized settings remains open`() async {
            let view = KowalskiAuthSettingsWindowView()
            view.isAuthorized = true
            let window = makeWindow(contentView: view)
            defer { window.close() }

            await view.windowTask?.value

            #expect(window.isVisible)
        }

        @Test
        func `Signed out settings closes even when opened directly`() async {
            let view = KowalskiAuthSettingsWindowView()
            let window = makeWindow(contentView: view)
            defer { window.close() }

            await view.windowTask?.value

            #expect(!window.isVisible)
        }

        @Test
        func `Losing authorization closes settings while another window is key`() async {
            let view = KowalskiAuthSettingsWindowView()
            view.isAuthorized = true
            let settings = makeWindow(contentView: view)
            let other = makeWindow(contentView: NSView())
            defer {
                settings.close()
                other.close()
            }
            other.makeKeyAndOrderFront(nil)
            await view.windowTask?.value

            view.isAuthorized = false
            await view.windowTask?.value

            #expect(!settings.isVisible)
            #expect(other.isVisible)
        }

        private func makeWindow(contentView: NSView) -> NSWindow {
            let window = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 500, height: 400),
                styleMask: [.titled, .closable], backing: .buffered, defer: false,
            )
            window.isReleasedWhenClosed = false
            window.contentView = contentView
            window.orderFront(nil)
            return window
        }
    }
#endif
