from math import sqrt


def test_main():
    array = []

    total = 0
    for i in range(10_000_000):
        total += sqrt(i)
        array.append(total)
    assert True
