//
//  Toast+View+extension.swift
//  KowalskiDesignSystem
//
//  Created by Kamaal M Farah on 10/12/25.
//

import KamaalUI
import SwiftUI

private let toastTopPadding: CGFloat = 8
private let toastDismissOffset: CGFloat = -12
private let toastPresentationAnimation = Animation.spring(duration: 0.45, bounce: 0.1)
private let toastDismissAnimationDuration = 0.18
private let toastDismissAnimation = Animation.easeOut(duration: toastDismissAnimationDuration)

public extension View {
    func toastView(toast: Binding<Toast?>) -> some View {
        modifier(ToastModifier(toast: toast))
    }
}

private struct ToastModifier: ViewModifier {
    @State private var workItem: DispatchWorkItem?
    @State private var removalWorkItem: DispatchWorkItem?
    @State private var presentationState = ToastPresentationState()

    @Binding var toast: Toast?

    init(toast: Binding<Toast?>) {
        _toast = toast
    }

    func body(content: Content) -> some View {
        content
            .ktakeSizeEagerly()
            .overlay(alignment: .top) {
                mainToastView
                    .padding(.top, toastTopPadding)
            }
            .onAppear(perform: syncInitialToast)
            .onChange(of: toast, handleToastChange)
            .onDisappear(perform: cancelPendingWorkItems)
    }

    @ViewBuilder
    private var mainToastView: some View {
        if let presentedToast = presentationState.toast {
            ToastView(style: presentedToast.style, message: presentedToast.message, width: presentedToast.width) {
                dismissToast()
            }
            .offset(y: presentationState.isVisible ? 0 : toastDismissOffset)
            .opacity(presentationState.isVisible ? 1 : 0)
            .allowsHitTesting(presentationState.isVisible)
        }
    }

    private func syncInitialToast() {
        guard let toast else { return }

        showToast(toast)
    }

    private func handleToastChange(_: Toast?, _ newToast: Toast?) {
        guard let newToast else {
            hideToast()
            return
        }

        showToast(newToast)
    }

    private func showToast(_ toast: Toast) {
        removalWorkItem?.cancel()
        removalWorkItem = nil
        presentationState.prepareToPresent(toast)

        #if os(iOS)
            UIImpactFeedbackGenerator(style: .light)
                .impactOccurred()
        #endif

        withAnimation(toastPresentationAnimation) {
            presentationState.show()
        }

        workItem?.cancel()
        workItem = nil
        guard toast.duration > 0 else { return }

        let task = DispatchWorkItem { dismissToast() }

        workItem = task
        DispatchQueue.main.asyncAfter(deadline: .now() + toast.duration, execute: task)
    }

    private func dismissToast() {
        if toast != nil {
            toast = nil
            return
        }

        hideToast()
    }

    private func hideToast() {
        workItem?.cancel()
        workItem = nil

        removalWorkItem?.cancel()
        guard presentationState.toast != nil else { return }

        withAnimation(toastDismissAnimation) {
            presentationState.startDismissal()
        }

        let task = DispatchWorkItem {
            presentationState.finishDismissal()
            removalWorkItem = nil
        }

        removalWorkItem = task
        DispatchQueue.main.asyncAfter(deadline: .now() + toastDismissAnimationDuration, execute: task)
    }

    private func cancelPendingWorkItems() {
        workItem?.cancel()
        workItem = nil
        removalWorkItem?.cancel()
        removalWorkItem = nil
    }
}

#Preview {
    @Previewable @State var toast: Toast?

    VStack {
        Button(action: { toast = .init(style: .success, message: "Wooooow!") }) {
            Text("Show Toast")
        }
    }
    .toastView(toast: $toast)
    .frame(width: 500, height: 500)
}
