Leaflet _Lite_ is a fork of the popular JS mapping library, [Leaflet](https://github.com/Leaflet/Leaflet), driven by my own opinions/priorities. I made extensive changes to the code, but much of it still derives directly from the original library. I
forked Leaflet after commit [245baccc23ea8c876591c388247c8572f6f94c42](https://github.com/samclaus/leaflet-lite/tree/245baccc23ea8c876591c388247c8572f6f94c42), which was published on May 24th, 2023. It is
possible that our projects will converge and I am happy to contribute code back into Leaflet. That said, please take a moment to read the Ukrainian-call-to-action from the Leaflet team before proceeding to the Leaflet _Lite_ information further down!

- [Ukraine needs your help](#ukraine-needs-your-help)
- [Goals](#goals)
- [Documentation](#documentation)

## Ukraine needs your help

Leaflet was created 11 years ago by [Volodymyr Agafonkin](https://agafonkin.com), a Ukrainian citizen living in Kyiv.

Russian bombs are now falling over Volodymyr's hometown. His family, his friends, his neighbours, thousands and thousands of absolutely wonderful people, are either seeking refuge or fighting for their lives.

Russian soldiers have already killed tens of thousands of civilians, including women and children, and are committing mass war crimes like gang rapes, executions, looting, and targeted bombings of civilian shelters and places of cultural significance. The death toll keeps rising, and Ukraine needs your help.

As Volodymyr [expressed a few days before the invasion](https://twitter.com/LeafletJS/status/1496051256409919489):

> If you want to help, educate yourself and others on the Russian threat, follow reputable journalists, demand severe Russian sanctions and Ukrainian support from your leaders, protest the war, reach out to Ukrainian friends, donate to Ukrainian charities. Just don't be silent.

Ukrainians are recommending the [Come Back Alive](https://savelife.in.ua/en/) charity. For other options, see [StandWithUkraine](https://stand-with-ukraine.pp.ua).

If an appeal to humanity doesn't work for you, I'll appeal to your egoism: the future of Ukrainian citizens is the future of Leaflet.

It is chilling to see Leaflet being used for [documenting Russia's war crimes](https://ukraine.bellingcat.com/), [factual reporting of the war](https://liveuamap.com/) and for coordination of humanitarian efforts [in Romania](https://refugees.ro/) and [in Poland](https://dopomoha.pl/). We commend these uses of Leaflet.

If you support the actions of the Russian government (even after reading all this), do everyone else a favour and [carry some seeds in your pocket](https://www.theguardian.com/world/video/2022/feb/25/ukrainian-woman-sunflower-seeds-russian-soldiers-video).

Yours truly,<br>
Leaflet maintainers.

## Goals

Note that some of the goals of this project are, in essence, pretty similar to the goals of the original Leaflet project.

- **Be an 85% solution for most mapping needs&mdash;no fancy 3D WebGL!**
- **Tiny bundle size (goal is 20KB minified OR LESS for most use-cases)**
- **Better runtime performance**
- **Smaller, easier-to-understand codebase and API (written in strict TypeScript)**
- **Thorough documentation that explains how everything works under-the-hood**
- **Licensed to the public domain (if possible)**

In order to achieve the above goals, I am willing to **SACRIFICE BROWSER SUPPORT**. I only care about
supporting, say, 90% of browsers, and I certainly don't care about supporting Internet Explorer.

That caveat aside, I think most of the goals can be accomplished without any serious drawbacks. Here is why:

- **Leaflet supports multiple ways to do the same thing.** You could use `layer.addTo(map)` or `map.addLayer(layer)`. Such features clutter the codebase with 'convenience' methods that obscure the core/important code and increase bundle size because JavaScript classes cannot be easily tree-shaken for unused methods (to my knowledge). The same stylistic options apply to data types: you could pass `new Point(15, 20)` or `[15, 20]` or `{ x: 15, y: 20 }` to the same functions. This makes the internal code quite messy because every API has to obsessively call conversion functions like `toPoint` which would take the above inputs and then always return a proper `Point` instance. Not only do polymorphic functions (functions which accept multiple types of data) seriously hurt JavaScript performance, but all of those `toPoint` (and similar) calls add up when it comes to JavaScript bundle size. Last but not least, this excess of choices actually makes the library harder to use for paranoid people like myself because I feel the need to go check that the alternative methods _actually_ do the exact same things in the exact same order. Programming often requires attention to the smallest details.

- **Leaflet is not easily tree-shakeable.** Even if you say, create a map with `new Map({ drag: false })`, most/all JavaScript bundlers will not be able to guarantee that all of the drag-to-pan implementation code is unused, so your application will still be pulling in that part of Leaflet. Instead of having boolean options to enable/disable such features, Leaflet _Lite_ requires you to import a separate function or class, such as `enableDragToPan(myMap, options)`, and that code will be completely left out of your application if you do not explicitly import and use it. In addition to behaviors like box-zoom and drag-to-pan, the `Map` class in Leaflet has to be aware of vector rendering layers like the `Canvas` and `SVG` classes so that it can instantiate them as necessary if you, say, add a polyline to your map. In Leaflet _Lite_, you are responsible for importing either `SVG` or `Canvas` (depending on which makes sense for your use case), registering it with the map, and then keeping a reference so you can directly add polylines to your `SVG`/`Canvas` instance. This way, you only import what you use. Use neither, and none of the vector rendering code will be bundled with your application. Period.

- **Leaflet implements everything as classes with extensions in mind.** This means that some of the classes even break up some of their internal methods into _multiple_ methods, presumably so that more code can be reused by custom subclasses created by users of Leaflet. I would rather provide a dirt simple 85% solution that covers the majority of use-cases and provide extensive documentation so that anyone needing a custom solution can roll their own easily enough and feel confident that it will work well.

- **Leaflet contains some redundant code.** For example, Leaflet contains `Point` and `Bound` classes for storing/manipulating XY(Z) pixel coordinates, and separate `LatLng` and `LatLngBounds` classes for manipulating XY(Z) geographic coordinates. These classes are near-identical look-alikes, and I figure they are probably there to help programmers be more explicit about what type of coordinates they are passing to any given API. That said, I think good function/variable names can make the code clear enough, and then we can just pass arrays with 2 or 3 numbers (depending on whether there is a Z coordinate). On a related note, it is very odd that Leaflet has a `LatLng` class where you pass in the latitude before the longitude&mdash;longitude is essentially an X-coordinate for the Earth, so writing `[latitude, longitude]` is like writing `[y, x]`. This switcheroo seems like a possible source of confusion.

The above criticisms of Leaflet are not intended to be an insult to the project. I didn't know shit about GIS software before Leaflet served as an excellent learning resource, and I still know relatively little.

## Documentation

| :construction: **UNDER CONSTRUCTION** :construction: |
|:--------------------------------------|
| Leaflet _Lite_ is currently a work-in-progress. No documentation is available yet and the API is highly unstable as I move things around and settle on a good-enough structure. I am using it for my own transit app so it is a serious project, but I don't see it being stable until October 2023 at the earliest! |
