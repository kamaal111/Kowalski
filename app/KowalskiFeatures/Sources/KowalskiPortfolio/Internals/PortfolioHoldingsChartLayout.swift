import Foundation

struct PortfolioHoldingsChartLayout {
    static let expansion: CGFloat = 8

    let holdings: [PortfolioHoldingDistributionItem]
    private let totalValue: Double

    init(holdings: [PortfolioHoldingDistributionItem]) {
        self.holdings = holdings
            .filter { $0.marketValue.value.isFinite && $0.marketValue.value > 0 }
            .sorted {
                if $0.marketValue.value == $1.marketValue.value {
                    return $0.symbol < $1.symbol
                }
                return $0.marketValue.value > $1.marketValue.value
            }
        totalValue = self.holdings.reduce(0) { $0 + $1.marketValue.value }
    }

    func percentage(for index: Int) -> Double {
        holdings[index].marketValue.value / totalValue * 100
    }

    static func outerRadius(in frame: CGRect) -> CGFloat {
        max(0, min(frame.width, frame.height) / 2 - expansion - 2)
    }

    static func innerRadius(in frame: CGRect) -> CGFloat {
        outerRadius(in: frame) * 0.55
    }

    func holdingIndex(at location: CGPoint, in frame: CGRect, selectedIndex: Int? = nil) -> Int? {
        guard totalValue.isFinite, totalValue > 0 else { return nil }

        let deltaX = location.x - frame.midX
        let deltaY = location.y - frame.midY
        let distance = hypot(deltaX, deltaY)
        guard distance >= Self.innerRadius(in: frame) else { return nil }

        let fullCircle = 2 * Double.pi
        let angle = (atan2(deltaX, -deltaY) + fullCircle).truncatingRemainder(dividingBy: fullCircle)
        let value = angle / fullCircle * totalValue
        var cumulativeValue = 0.0
        for index in holdings.indices {
            cumulativeValue += holdings[index].marketValue.value
            if value < cumulativeValue {
                let radius = Self.outerRadius(in: frame) + (selectedIndex == index ? Self.expansion : 0)
                return distance <= radius ? index : nil
            }
        }
        return nil
    }

    static func tooltipOrigin(near location: CGPoint, size: CGSize, bounds: CGSize) -> CGPoint {
        let gap: CGFloat = 12
        let originX = location.x + gap + size.width <= bounds.width
            ? location.x + gap : location.x - gap - size.width
        let originY = location.y + gap + size.height <= bounds.height
            ? location.y + gap : location.y - gap - size.height
        return CGPoint(
            x: min(max(0, originX), max(0, bounds.width - size.width)),
            y: min(max(0, originY), max(0, bounds.height - size.height)),
        )
    }
}
