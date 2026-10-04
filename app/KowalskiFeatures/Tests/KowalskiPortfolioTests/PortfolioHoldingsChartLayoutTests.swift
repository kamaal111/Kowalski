import Foundation
@testable import KowalskiPortfolio
import Testing

struct PortfolioHoldingsChartLayoutTests {
    private let frame = CGRect(x: 20, y: 30, width: 220, height: 220)

    @Test
    func `Slices follow descending market value clockwise from the top`() {
        let layout = makeLayout()

        #expect(layout.holdings.map(\.symbol) == ["LARGE", "SMALL"])
        #expect(layout.holdingIndex(at: CGPoint(x: 210, y: 140), in: frame) == 0)
        #expect(layout.holdingIndex(at: CGPoint(x: 50, y: 139), in: frame) == 1)
        #expect(layout.holdingIndex(at: CGPoint(x: 130, y: 60), in: frame) == 0)
        #expect(layout.holdingIndex(at: CGPoint(x: 50, y: 140), in: frame) == 1)
    }

    @Test
    func `Percentages reflect the plotted market values`() {
        let layout = makeLayout()

        #expect(layout.percentage(for: 0) == 75)
        #expect(layout.percentage(for: 1) == 25)
    }

    @Test
    func `A one percent slice remains selectable immediately before the top boundary`() {
        let layout = PortfolioHoldingsChartLayout(holdings: [
            holding(symbol: "LARGE", value: 99), holding(symbol: "SMALL", value: 1),
        ])

        #expect(layout.holdingIndex(at: CGPoint(x: 128, y: 60), in: frame) == 1)
        #expect(layout.percentage(for: 1) == 1)
    }

    @Test
    func `A single holding fills the donut in a wide plot`() {
        let layout = PortfolioHoldingsChartLayout(holdings: [holding(symbol: "ONLY", value: 100)])
        let wideFrame = CGRect(x: 20, y: 30, width: 400, height: 220)

        #expect(layout.holdingIndex(at: CGPoint(x: 300, y: 140), in: wideFrame) == 0)
        #expect(layout.holdingIndex(at: CGPoint(x: 140, y: 140), in: wideFrame) == 0)
        #expect(layout.percentage(for: 0) == 100)
    }

    @Test
    func `The donut hole and space outside the slices do not select holdings`() {
        let layout = makeLayout()

        #expect(layout.holdingIndex(at: CGPoint(x: 130, y: 140), in: frame) == nil)
        #expect(layout.holdingIndex(at: CGPoint(x: 180, y: 140), in: frame) == nil)
        #expect(layout.holdingIndex(at: CGPoint(x: 240, y: 140), in: frame) == nil)
    }

    @Test
    func `The expanded edge retains selection only for the active slice`() {
        let layout = makeLayout()
        let point = CGPoint(x: 235, y: 140)

        #expect(layout.holdingIndex(at: point, in: frame) == nil)
        #expect(layout.holdingIndex(at: point, in: frame, selectedIndex: 0) == 0)
        #expect(layout.holdingIndex(at: point, in: frame, selectedIndex: 1) == nil)
    }

    @Test
    func `Empty and zero total distributions cannot select a slice`() {
        let empty = PortfolioHoldingsChartLayout(holdings: [])
        let zero = PortfolioHoldingsChartLayout(holdings: [holding(symbol: "ZERO", value: 0)])

        #expect(empty.holdingIndex(at: CGPoint(x: 210, y: 140), in: frame) == nil)
        #expect(zero.holdingIndex(at: CGPoint(x: 210, y: 140), in: frame) == nil)
    }

    @Test
    func `Nonpositive and nonfinite holdings do not distort the plotted percentages`() {
        let layout = PortfolioHoldingsChartLayout(holdings: [
            holding(symbol: "VALID", value: 100),
            holding(symbol: "ZERO", value: 0),
            holding(symbol: "NEGATIVE", value: -100),
            holding(symbol: "INVALID", value: .nan),
        ])

        #expect(layout.holdings.map(\.symbol) == ["VALID"])
        #expect(layout.percentage(for: 0) == 100)
    }

    @Test
    func `Tooltip placement stays inside the chart at either edge`() {
        let size = CGSize(width: 140, height: 60)
        let bounds = CGSize(width: 300, height: 220)

        #expect(PortfolioHoldingsChartLayout.tooltipOrigin(
            near: CGPoint(x: 290, y: 210), size: size, bounds: bounds,
        ) == CGPoint(x: 138, y: 138))
        #expect(PortfolioHoldingsChartLayout.tooltipOrigin(
            near: .zero, size: size, bounds: bounds,
        ) == CGPoint(x: 12, y: 12))
    }

    private func makeLayout() -> PortfolioHoldingsChartLayout {
        PortfolioHoldingsChartLayout(holdings: [
            holding(symbol: "SMALL", value: 25),
            holding(symbol: "LARGE", value: 75),
        ])
    }

    private func holding(symbol: String, value: Double) -> PortfolioHoldingDistributionItem {
        PortfolioHoldingDistributionItem(
            symbol: symbol, name: symbol, marketValue: Money(currency: .USD, value: value),
        )
    }
}
