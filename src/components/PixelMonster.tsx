import { View } from 'react-native';

const art = [
  '....GGGGGG....',
  '..GGGGGGGGGG..',
  '.GGGGGGGGGGGG.',
  'GGGGGWWWWGGGGG',
  'GGGGWKKKKWGGGG',
  'GGGGWWKKWWGGGG',
  '.GGGGGGGGGGGG.',
  '..GGGGGGGGGG..',
  '...GOGGGGOG...',
  '..GGG....GGG..',
  '.GGGG....GGGG.',
  'GGGGG....GGGGG',
];

const colors: Record<string, string> = {
  G: '#4de082',
  W: '#d7ffe1',
  K: '#001805',
  O: '#f5b45f',
};

export function PixelMonster({ small = false }: { small?: boolean }) {
  const pixel = small ? 7 : 9;
  return (
    <View
      accessibilityLabel="Vua Slime dạng pixel"
      accessibilityRole="image"
      style={{ width: 14 * pixel, height: 12 * pixel, alignSelf: 'center' }}
    >
      {art.flatMap((row, rowIndex) =>
        [...row].map((cell, columnIndex) =>
          cell === '.' ? null : (
            <View
              key={`${rowIndex}-${columnIndex}`}
              style={{
                position: 'absolute',
                left: columnIndex * pixel,
                top: rowIndex * pixel,
                width: pixel,
                height: pixel,
                backgroundColor: colors[cell],
              }}
            />
          ),
        ),
      )}
    </View>
  );
}
