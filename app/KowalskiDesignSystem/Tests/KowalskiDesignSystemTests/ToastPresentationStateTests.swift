//
//  ToastPresentationStateTests.swift
//  KowalskiDesignSystem
//
//  Created by OpenAI Codex on 4/4/26.
//

@testable import KowalskiDesignSystem
import Testing

@Suite("ToastPresentationState Tests")
struct ToastPresentationStateTests {
    @Test
    func `presenting a toast should stage it before making it visible`() {
        var state = ToastPresentationState()
        let toast = Toast.success(message: "Entry saved")

        state.prepareToPresent(toast)

        #expect(state.toast == toast)
        #expect(state.isVisible == false)

        state.show()

        #expect(state.toast == toast)
        #expect(state.isVisible)
    }

    @Test
    func `starting dismissal should keep the toast mounted until cleanup finishes`() {
        var state = ToastPresentationState()
        let toast = Toast.success(message: "Entry saved")
        state.prepareToPresent(toast)
        state.show()

        state.startDismissal()

        #expect(state.toast == toast)
        #expect(state.isVisible == false)

        state.finishDismissal()

        #expect(state.toast == nil)
        #expect(state.isVisible == false)
    }

    @Test
    func `presenting a new toast during dismissal should show the replacement toast`() {
        var state = ToastPresentationState()
        let firstToast = Toast.success(message: "Entry saved")
        let secondToast = Toast.error(message: "Entry failed")
        state.prepareToPresent(firstToast)
        state.show()
        state.startDismissal()

        state.prepareToPresent(secondToast)

        #expect(state.toast == secondToast)
        #expect(state.isVisible == false)

        state.show()

        #expect(state.toast == secondToast)
        #expect(state.isVisible)
    }
}
