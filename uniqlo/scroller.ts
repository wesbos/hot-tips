const scroller = document.querySelector('.scroller');


// Find all the scroll snap items
scroller?.addEventListener('scrollsnapchanging', (e: SnapEvent) => {
  document.querySelector('a.active')?.classList.remove('active');
  window.location.hash = e.snapTargetBlock.id;
  document.querySelector(`a[href="#${e.snapTargetBlock.id}"]`)?.classList.add('active');
})
